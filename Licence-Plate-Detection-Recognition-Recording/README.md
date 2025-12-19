# License Plate Detection & Recognition System

YOLO-based license plate detection with PaddleOCR recognition, optimized for Vietnamese plates (including 2-line format).

## Project Structure

```
Licence-Plate-Detection-Recognition-Recording/
├── detections/              # Detection modules
│   ├── car_detection.py
│   └── licence_plate_detection.py
├── utils/                   # Utility functions
│   └── video_utils.py
├── models/                  # YOLO model weights
│   └── best.pt             # License plate detection model
├── samples/                 # Sample test images
│   ├── test.png
│   └── image.png
├── outputs/                 # Captured plates (gitignored)
├── temp/                    # Temporary/debug files (gitignored)
├── docs/                    # Documentation
│   ├── INTEGRATION_GUIDE.md
│   └── VIETNAMESE_PLATE_FIX.md
├── input_videos/            # Input video files (gitignored)
├── output_videos/           # Output video files (gitignored)
├── tracker_stubs/           # Detection cache
├── main.py                  # Video processing script
├── plate_capture.py         # Main capture script for backend integration
├── test_images.py           # Test script for static images
├── debug_ocr.py             # OCR debugging utility
└── requirements.txt         # Python dependencies
```

## Quick Start

### 1. Setup Environment

```bash
# Create virtual environment
python -m venv venv

# Activate (Windows PowerShell)
.\venv\Scripts\Activate.ps1

# Install dependencies
pip install ultralytics paddleocr paddlepaddle opencv-python
```

### 2. Test with Sample Images

```bash
# Test detection on sample images
python test_images.py

# Test plate capture (dry run, no backend)
python plate_capture.py
```

### 3. Configuration

Environment variables (create `.env` file or set in shell):

```bash
# Mode: 'image' or 'camera'
MODE=image

# Image path (when MODE=image)
IMAGE_PATH=samples/image.png

# Camera index (when MODE=camera)
CAM_INDEX=0

# Backend integration
BACKEND_BASE=http://localhost:8000
DRY_RUN=true  # Set to 'false' to enable backend posting

# Output directory
OUTPUT_DIR=outputs
```

### 4. Run with Backend

```bash
# Test with image (no backend)
python plate_capture.py

# Connect to backend
$env:DRY_RUN="false"
python plate_capture.py

# Use camera
$env:MODE="camera"
$env:DRY_RUN="false"
python plate_capture.py
```

## Features

✅ **Vietnamese 2-line plate support** - Automatically detects and joins both lines  
✅ **High accuracy** - 95%+ confidence with PaddleOCR  
✅ **Fast inference** - ~60-100ms per image  
✅ **Flexible input** - Camera or static images  
✅ **Backend integration** - Ready for API posting  
✅ **Dry run mode** - Test without backend  

## Detection Examples

**Vietnamese 2-line plate:**
```
Raw: '90-B2 452.30'
Sanitized: '90-B245230'
```

**Single-line plate:**
```
Raw: '51G-394.66'
Sanitized: '51G-39466'
```

## Scripts

- **`plate_capture.py`** - Main production script for backend integration
- **`test_images.py`** - Test detection on multiple images, show formatting options
- **`debug_ocr.py`** - Debug OCR output, inspect detection pipeline
- **`main.py`** - Process videos with car and plate detection

## Model Files

- `yolo11n.pt` - YOLO11 nano model for car detection
- `models/best.pt` - Custom trained model for license plate detection

## Documentation

See `docs/` folder for:
- Integration guide
- Vietnamese plate format fix details
- API documentation

## Notes

- First run will download PaddleOCR models (~200MB)
- Model files (`.pt`) are excluded from git
- Output images saved to `outputs/` folder with timestamp
