"""
LPD API Service Wrapper
Exposes LPD detection capabilities via HTTP API
"""

import os
import sys
import json
import base64
from pathlib import Path
from io import BytesIO
import numpy as np
import cv2

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from flask import Flask, request, jsonify
from services.plate_normalizer import PlateNormalizer
from config.settings import AppConfig
from detections.licence_plate_detection import LicencePlateDetection

app = Flask(__name__)

# Initialize services
detector = None
normalizer = PlateNormalizer()
config = AppConfig.from_env()


def initialize_services():
    """Initialize detection service on startup"""
    global detector
    try:
        detector = LicencePlateDetection(str(config.model.plate_model_path))
        print("✓ LicencePlateDetection initialized")
        print(f"  Model path: {config.model.plate_model_path}")
    except Exception as e:
        print(f"✗ Failed to initialize LicencePlateDetection: {e}")
        import traceback
        traceback.print_exc()


# Initialize services immediately when module loads
print("Initializing LPD services...")
initialize_services()


@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    detector_status = 'initialized' if detector is not None else 'not_initialized'
    status_code = 200 if detector is not None else 503
    
    return jsonify({
        'status': 'healthy' if detector is not None else 'unhealthy',
        'service': 'lpd-api',
        'version': '1.0.0',
        'detector': detector_status
    }), status_code


@app.route('/api/detect', methods=['POST'])
def detect_license_plate():
    """
    Detect license plate from base64-encoded image
    
    Request JSON:
    {
        "image": "data:image/jpeg;base64,..." or just base64 string
    }
    
    Response JSON:
    {
        "success": true,
        "normalized_plate": "51G-39466",
        "raw_text": "51G-394.66",
        "confidence": 0.95,
        "detection_time_ms": 125
    }
    """
    try:
        # Get request data
        data = request.get_json()
        
        if not data or 'image' not in data:
            return jsonify({
                'success': False,
                'error': 'Image data is required'
            }), 400
        
        image_data = data['image']
        
        # Handle data URL format (remove prefix if present)
        if isinstance(image_data, str) and image_data.startswith('data:image'):
            # Extract base64 part from data URL
            image_data = image_data.split(',')[1]
        
        # Decode base64 image
        try:
            image_bytes = base64.b64decode(image_data)
            # Convert bytes to numpy array for OpenCV
            import numpy as np
            nparr = np.frombuffer(image_bytes, np.uint8)
            image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            if image is None:
                raise ValueError('Failed to decode image')
        except Exception as e:
            return jsonify({
                'success': False,
                'error': f'Failed to decode image: {str(e)}'
            }), 400
        
        if not detector:
            return jsonify({
                'success': False,
                'error': 'Detection service not initialized'
            }), 503
        
        # Detect plate
        detection_result = detector.detect_plate_from_frame(image)
        
        if not detection_result['success']:
            return jsonify({
                'success': False,
                'error': detection_result.get('error', 'Failed to detect plate')
            }), 422
        
        # Normalize plate
        raw_text = detection_result.get('plate_text', detection_result.get('raw_text', ''))
        normalized_plate = normalizer.sanitize(raw_text)
        
        # Cleanup image arrays
        del image, nparr, image_bytes
        import gc
        gc.collect()
        
        if not normalized_plate:
            return jsonify({
                'success': False,
                'error': 'Failed to normalize detected plate'
            }), 422
        
        return jsonify({
            'success': True,
            'normalized_plate': normalized_plate,
            'raw_text': raw_text,
            'confidence': detection_result.get('confidence', 0.9),
            'detection_time_ms': detection_result.get('detection_time_ms', 0)
        }), 200
        
    except Exception as e:
        print(f"Error in detect_license_plate: {str(e)}")
        return jsonify({
            'success': False,
            'error': f'Internal server error: {str(e)}'
        }), 500


@app.route('/api/detect-batch', methods=['POST'])
def detect_batch():
    """
    Detect license plates from multiple images (batch processing)
    
    Request JSON:
    {
        "images": [
            "base64_image_1",
            "base64_image_2",
            ...
        ]
    }
    """
    try:
        data = request.get_json()
        
        if not data or 'images' not in data:
            return jsonify({
                'success': False,
                'error': 'Images array is required'
            }), 400
        
        images = data['images']
        
        if not isinstance(images, list):
            return jsonify({
                'success': False,
                'error': 'Images must be an array'
            }), 400
        
        if len(images) == 0:
            return jsonify({
                'success': False,
                'error': 'At least one image is required'
            }), 400
        
        if len(images) > 10:
            return jsonify({
                'success': False,
                'error': 'Maximum 10 images per batch'
            }), 400
        
        results = []
        
        for idx, image_data in enumerate(images):
            try:
                # Decode and detect
                if isinstance(image_data, str) and image_data.startswith('data:image'):
                    image_data = image_data.split(',')[1]
                
                image_bytes = base64.b64decode(image_data)
                nparr = np.frombuffer(image_bytes, np.uint8)
                image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                
                detection_result = detector.detect_plate_from_frame(image)
                
                if detection_result.get('success', False):
                    raw_text = detection_result.get('plate_text', detection_result.get('raw_text', ''))
                    normalized_plate = normalizer.sanitize(raw_text)
                    
                    results.append({
                        'image_index': idx,
                        'success': True,
                        'normalized_plate': normalized_plate,
                        'raw_text': raw_text,
                        'confidence': detection_result.get('confidence', 0.9)
                    })
                else:
                    results.append({
                        'image_index': idx,
                        'success': False,
                        'error': detection_result.get('error', 'Detection failed')
                    })
                
                # Cleanup after each iteration
                del image, nparr, image_bytes
                if 'detection_result' in locals():
                    del detection_result
                    
            except Exception as e:
                results.append({
                    'image_index': idx,
                    'success': False,
                    'error': str(e)
                })
                # Cleanup on error
                if 'image' in locals():
                    del image
                if 'nparr' in locals():
                    del nparr
                if 'image_bytes' in locals():
                    del image_bytes
        
        # Final cleanup
        import gc
        gc.collect()
        
        return jsonify({
            'success': True,
            'total': len(images),
            'successful': sum(1 for r in results if r.get('success')),
            'results': results
        }), 200
        
    except Exception as e:
        print(f"Error in detect_batch: {str(e)}")
        return jsonify({
            'success': False,
            'error': f'Internal server error: {str(e)}'
        }), 500

@app.route('/api/metrics', methods=['GET'])
def get_metrics():
    """Get service metrics including memory usage"""
    try:
        import psutil
        import os
        
        process = psutil.Process(os.getpid())
        memory_info = process.memory_info()
        
        return jsonify({
            'success': True,
            'memory': {
                'rss_mb': round(memory_info.rss / 1024 / 1024, 2),
                'vms_mb': round(memory_info.vms / 1024 / 1024, 2),
                'percent': round(process.memory_percent(), 2)
            },
            'cpu_percent': process.cpu_percent(interval=0.1),
            'num_threads': process.num_threads()
        }), 200
    except ImportError:
        return jsonify({
            'success': False,
            'error': 'psutil not installed'
        }), 500
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/config', methods=['GET'])
def get_config():
    """Get service configuration"""
    return jsonify({
        'service': 'lpd-api',
        'version': '1.0.0',
        'models': {
            'yolo': 'best.pt',
            'ocr': 'PaddleOCR'
        },
        'capabilities': [
            'single-detection',
            'batch-detection',
            'vietnamese-plates'
        ]
    }), 200


@app.errorhandler(404)
def not_found(error):
    """Handle 404 errors"""
    return jsonify({
        'success': False,
        'error': 'Endpoint not found'
    }), 404


@app.errorhandler(500)
def internal_error(error):
    """Handle 500 errors"""
    return jsonify({
        'success': False,
        'error': 'Internal server error'
    }), 500


if __name__ == '__main__':
    # Services already initialized at module load
    
    # Get port from environment or use default
    port = int(os.getenv('LPD_API_PORT', 5000))
    host = os.getenv('LPD_API_HOST', '0.0.0.0')
    debug = os.getenv('LPD_API_DEBUG', 'False').lower() == 'true'
    
    print(f"Starting LPD API Service on {host}:{port}")
    print(f"Debug mode: {debug}")
    print("Endpoints:")
    print("  GET  /health")
    print("  POST /api/detect")
    print("  POST /api/detect-batch")
    print("  GET  /api/metrics")
    print("  GET  /api/config")
    
    app.run(host=host, port=port, debug=debug)
