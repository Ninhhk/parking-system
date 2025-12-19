# LPD Service Fix Documentation

**Date:** December 14, 2025  
**Issue:** License Plate Detection service was failing with 503 and 422 errors

---

## Problems Encountered

### 1. Error 503 - Detection Service Not Initialized
```
LPD Service error: Request failed with status code 503
LPD detection error: Error: Detection service not initialized
```

**Symptoms:**
- Backend could reach LPD service endpoint
- Health check failed (503 status)
- Detector object was `null`/uninitialized

### 2. Error 422 - Failed to Read Plate Text
```
LPD Service error: Request failed with status code 422
LPD detection error: Error: Failed to read plate text
```

**Symptoms:**
- YOLO successfully detected license plate bounding boxes
- PaddleOCR ran and found text regions
- OCR text extraction returned "N/A" instead of actual text

---

## Root Causes

### Issue 1: Service Initialization Timing
**Problem:** The `initialize_services()` function was only called in the `if __name__ == '__main__'` block:

```python
if __name__ == '__main__':
    initialize_services()  # Only runs when script executed directly
    app.run(...)
```

**Why it failed:**
- Docker containers often run Flask apps via WSGI servers (Gunicorn, uWSGI)
- WSGI servers import the module but don't execute `__main__` block
- Detector remained uninitialized, causing all detection requests to fail

### Issue 2: Model Compatibility
**Problem:** YOLO model was trained with newer Ultralytics version

```
AttributeError: Can't get attribute 'C3k2' on <module 'ultralytics.nn.modules.block'>
```

**Why it failed:**
- Model (`best.pt`) trained with Ultralytics 8.3.x (has C3k2 module)
- Docker image used Ultralytics 8.0.196 (no C3k2 module)
- Model deserialization failed due to missing architecture components

### Issue 3: PaddleOCR Result Parsing
**Problem:** Incorrect parsing of PaddleOCR API response format

```python
# Incorrect - checking for non-existent format
if "rec_texts" in result_data:
    rec_texts = result_data["rec_texts"]
```

**Why it failed:**
- PaddleOCR returns: `[[[bbox_coords], (text, confidence)], ...]`
- Code expected: `{"rec_texts": [...]}`
- Mismatched format caused all OCR results to be ignored → "N/A"

---

## Solutions Implemented

### Fix 1: Module-Level Initialization

**File:** `Licence-Plate-Detection-Recognition-Recording/api_server.py`

**Changes:**
```python
# Before
def initialize_services():
    global detector
    try:
        detector = LicencePlateDetection(str(config.model.plate_model_path))
        print("✓ LicencePlateDetection initialized")
    except Exception as e:
        print(f"✗ Failed to initialize LicencePlateDetection: {e}")

# After
def initialize_services():
    global detector
    try:
        detector = LicencePlateDetection(str(config.model.plate_model_path))
        print("✓ LicencePlateDetection initialized")
        print(f"  Model path: {config.model.plate_model_path}")
    except Exception as e:
        print(f"✗ Failed to initialize LicencePlateDetection: {e}")
        import traceback
        traceback.print_exc()

# Initialize immediately when module loads (not in __main__)
print("Initializing LPD services...")
initialize_services()
```

**Benefits:**
- ✅ Detector initializes regardless of how Flask app starts
- ✅ Works with development server, Gunicorn, uWSGI, etc.
- ✅ Better error logging with full traceback

### Fix 2: Enhanced Health Endpoint

**File:** `Licence-Plate-Detection-Recognition-Recording/api_server.py`

**Changes:**
```python
# Before
@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'healthy',
        'service': 'lpd-api',
        'version': '1.0.0'
    }), 200

# After
@app.route('/health', methods=['GET'])
def health_check():
    detector_status = 'initialized' if detector is not None else 'not_initialized'
    status_code = 200 if detector is not None else 503
    
    return jsonify({
        'status': 'healthy' if detector is not None else 'unhealthy',
        'service': 'lpd-api',
        'version': '1.0.0',
        'detector': detector_status
    }), status_code
```

**Benefits:**
- ✅ Health check reflects actual detector status
- ✅ Returns 503 when detector not initialized
- ✅ Enables proper Docker health monitoring

### Fix 3: Upgrade Ultralytics Version

**File:** `Licence-Plate-Detection-Recognition-Recording/requirements-prod.txt`

**Changes:**
```diff
- ultralytics==8.0.196
+ ultralytics>=8.3.0
```

**Benefits:**
- ✅ Supports C3k2 and other modern YOLO modules
- ✅ Compatible with current YOLO v8/v11 models
- ✅ Access to latest bug fixes and improvements

### Fix 4: Correct PaddleOCR Parsing

**File:** `Licence-Plate-Detection-Recognition-Recording/detections/licence_plate_detection.py`

**Changes:**
```python
# Before
if ocr_result and ocr_result[0]:
    result_data = ocr_result[0]
    if hasattr(result_data, "__getitem__") and "rec_texts" in result_data:
        rec_texts = result_data.get("rec_texts", [])
        if rec_texts:
            plate_text = " ".join(rec_texts)

# After
if ocr_result and ocr_result[0]:
    result_data = ocr_result[0]
    # PaddleOCR returns list of [[[bbox], (text, confidence)], ...]
    if isinstance(result_data, list):
        texts = []
        for line in result_data:
            if len(line) >= 2 and isinstance(line[1], tuple):
                text, conf = line[1]
                if text and conf > 0.5:  # Only include high-confidence text
                    texts.append(text)
        if texts:
            plate_text = " ".join(texts)
            logger.debug(f"OCR detected: {plate_text} from {len(texts)} line(s)")
    # Legacy format check for backward compatibility
    elif hasattr(result_data, "__getitem__") and "rec_texts" in result_data:
        rec_texts = result_data.get("rec_texts", [])
        if rec_texts:
            plate_text = " ".join(rec_texts)
```

**Benefits:**
- ✅ Correctly extracts text from actual PaddleOCR format
- ✅ Filters low-confidence results (< 0.5)
- ✅ Handles multi-line plates (Vietnamese format)
- ✅ Maintains backward compatibility with legacy formats
- ✅ Better debug logging for troubleshooting

---

## Files Modified

| File | Changes | Purpose |
|------|---------|---------|
| `Licence-Plate-Detection-Recognition-Recording/api_server.py` | Module-level initialization, enhanced health endpoint | Ensure detector initializes on any deployment method |
| `Licence-Plate-Detection-Recognition-Recording/requirements-prod.txt` | Upgraded `ultralytics>=8.3.0` | Model compatibility with C3k2 module |
| `Licence-Plate-Detection-Recognition-Recording/detections/licence_plate_detection.py` | Fixed OCR result parsing in 2 methods | Correctly extract text from PaddleOCR results |

---

## Verification Steps

### 1. Check Health Endpoint
```bash
docker exec parking-lot-lpd curl -s http://localhost:8000/health
```

**Expected Response:**
```json
{
    "detector": "initialized",
    "service": "lpd-api",
    "status": "healthy",
    "version": "1.0.0"
}
```

### 2. Test from Backend Container
```bash
docker exec parking-lot-backend node -e "require('http').get('http://lpd-service:8000/health', (res) => { let data = ''; res.on('data', chunk => data += chunk); res.on('end', () => console.log(data)); })"
```

**Expected:** Same healthy response showing detector initialized

### 3. Upload License Plate Image
- Navigate to employee parking interface
- Capture or upload license plate image
- Should successfully detect and return plate number

---

## Technical Details

### Docker Service Configuration
**Service Name:** `lpd-service` (container: `parking-lot-lpd`)  
**Network:** `parking-lot-network`  
**Backend Connection:** `http://lpd-service:8000`  
**Health Check:** `curl -f http://localhost:8000/health` every 30s

### Detection Pipeline
1. **YOLO Detection:** Find license plate bounding boxes in image
2. **Image Preprocessing:** Convert to grayscale, resize 2x for better OCR
3. **PaddleOCR:** Extract text from cropped plate region
4. **Text Normalization:** Clean and format detected text
5. **Response:** Return normalized plate, raw text, confidence score

### API Endpoints
- `GET /health` - Service health and detector status
- `POST /api/detect` - Detect single license plate from base64 image
- `POST /api/detect-batch` - Batch detection (up to 10 images)
- `GET /api/config` - Service configuration info

---

## Deployment Commands

### Rebuild LPD Service
```bash
docker compose -f docker-compose.partial.yml up -d --build lpd-service
```

### Restart Backend (After LPD Changes)
```bash
docker restart parking-lot-backend
```

### View Logs
```bash
# LPD service logs
docker logs parking-lot-lpd --tail 50 -f

# Backend logs
docker logs parking-lot-backend --tail 50 -f
```

---

## Troubleshooting

### If Detector Still Not Initialized
1. Check LPD logs: `docker logs parking-lot-lpd`
2. Verify model file exists: `docker exec parking-lot-lpd ls -la /app/models/best.pt`
3. Check Ultralytics version: `docker exec parking-lot-lpd pip show ultralytics`

### If OCR Returns "N/A"
1. Ensure image quality is good (resolution, lighting, clarity)
2. Check OCR confidence threshold (currently 0.5)
3. Review PaddleOCR debug logs in container output

### Connection Issues
1. Verify network: `docker network inspect parking-lot-network`
2. Test connectivity: `docker exec parking-lot-backend ping lpd-service`
3. Check environment variable: `LPD_API_URL=http://lpd-service:8000`

---

## Success Metrics

✅ **Service Initialization:** Detector initializes on container start  
✅ **Health Check:** Returns 200 with `"detector": "initialized"`  
✅ **Backend Connectivity:** Backend can reach LPD service  
✅ **License Plate Detection:** Successfully detects plates from images  
✅ **OCR Text Extraction:** Correctly reads text from detected plates  
✅ **Error Handling:** Proper 422/503 responses with meaningful messages  

---

## Future Improvements

1. **Production WSGI Server:** Replace Flask dev server with Gunicorn
2. **OCR Confidence Tuning:** Make confidence threshold configurable
3. **Multi-Language Support:** Add Vietnamese character dictionary
4. **Batch Processing:** Optimize for concurrent requests
5. **Caching:** Cache model loading for faster cold starts
6. **Metrics:** Add Prometheus metrics for detection performance
