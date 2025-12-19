# LPD Optimization Implementation Summary

## Problems Addressed

### 1. Docker Image Size (15GB → 5-6GB Expected)
**Root Cause:** Unnecessary files being copied into Docker image, especially local `venv/` directory

**Solution:** Updated [.dockerignore](.dockerignore) with comprehensive exclusions:
- Python virtual environments (`venv/`, `env/`)
- Output directories (`outputs/`, `detections/`, `samples/`)
- PaddleOCR cache (`.paddlex/`)
- IDE files (`.vscode/`, `.idea/`)
- Test files and pytest cache
- Development requirements
- Model weights (`.pt`, `.pth`, `.onnx`) - should be volume-mounted instead

**Expected Reduction:** ~10GB (from 15GB → 5-6GB)

### 2. Memory Leaks (RAM Growth After Each Recognition)
**Root Causes:**
- Duplicate PaddleOCR initialization (~200MB per init)
- No cleanup of OpenCV image arrays (~5-20MB per request)
- YOLO/OCR inference outputs accumulating (~10-30MB per request)
- Batch processing without cleanup (~50-200MB per batch)

**Solutions Implemented:**

#### A. Fixed Critical Duplicate Initialization
- [licence_plate_detection.py](Licence-Plate-Detection-Recognition-Recording/detections/licence_plate_detection.py#L27-L37): Removed duplicate `PaddleOCR()` initialization
- Added optimized PaddleOCR config (CPU-only, limited threads, reduced logging)

#### B. Added Memory Cleanup in Detection Methods
- [licence_plate_detection.py](Licence-Plate-Detection-Recognition-Recording/detections/licence_plate_detection.py#L39-L52): Added `cleanup_inference_cache()` method
- [detect_frame](Licence-Plate-Detection-Recognition-Recording/detections/licence_plate_detection.py#L99-L103): Added cleanup of intermediate image arrays after processing
- [detect_plate_from_frame](Licence-Plate-Detection-Recognition-Recording/detections/licence_plate_detection.py#L185-L189): Added garbage collection after detection

#### C. Added Memory Cleanup in API Endpoints
- [/api/detect](Licence-Plate-Detection-Recognition-Recording/api_server.py#L129-L133): Delete image arrays and force GC after processing
- [/api/detect-batch](Licence-Plate-Detection-Recognition-Recording/api_server.py#L238-L253): Cleanup after each iteration AND final cleanup
- Added error handling cleanup to prevent leaks on exceptions

#### D. Added Memory Monitoring
- [/api/metrics](Licence-Plate-Detection-Recognition-Recording/api_server.py#L268-L295): New endpoint to monitor memory usage (RSS, VMS, %, CPU, threads)
- Uses `psutil` for real-time monitoring

## Production Deployment Enhancements

### 1. Gunicorn Production Server
**File:** [gunicorn.conf.py](Licence-Plate-Detection-Recognition-Recording/gunicorn.conf.py)

**Key Features:**
- **Worker Recycling:** `max_requests=100` - Workers restart after 100 requests to clear accumulated memory
- **Single Worker:** Avoids memory duplication of ML models (1.5GB+ per worker)
- **Thread-based Concurrency:** 2 threads per worker for concurrent requests
- **Extended Timeout:** 120s for slow OCR operations
- **Environment Optimization:** Limited OpenMP/MKL threads to reduce CPU contention

### 2. Docker Memory Limits
**File:** [docker-compose.partial.yml](docker-compose.partial.yml)

```yaml
deploy:
  resources:
    limits:
      memory: 2G
    reservations:
      memory: 1G
```

**Purpose:**
- Hard limit prevents runaway memory consumption
- Reservation ensures sufficient memory for base ML dependencies (~1.5GB)
- Container will be killed if exceeding 2GB (fail-fast instead of degrading host)

### 3. Updated Dependencies
**File:** [requirements-prod.txt](Licence-Plate-Detection-Recognition-Recording/requirements-prod.txt)

Added:
- `gunicorn==21.2.0` - Production WSGI server
- `psutil==5.9.6` - System monitoring for metrics endpoint

### 4. Updated Dockerfile
**File:** [Dockerfile.lpd](Dockerfile.lpd)

Changes:
- Added environment variables for thread limiting (`OMP_NUM_THREADS`, `MKL_NUM_THREADS`)
- Changed CMD to use gunicorn: `gunicorn --config gunicorn.conf.py api_server:app`

## Testing & Validation

### Build and Test
```powershell
# Rebuild with optimizations
docker-compose -f docker-compose.partial.yml build lpd-service

# Check new image size
docker images parking-lot-lpd

# Start service
docker-compose -f docker-compose.partial.yml up -d lpd-service

# Monitor memory usage
curl http://localhost:8000/api/metrics

# Watch memory over time (run multiple detections)
while ($true) {
    curl http://localhost:8000/api/metrics | jq '.memory'
    Start-Sleep -Seconds 5
}
```

### Expected Results
1. **Image Size:** Should be ~5-6GB (down from 15GB)
2. **Memory Usage:** Should stabilize around 1.5-1.8GB during operation
3. **Memory Growth:** Minimal growth over time, workers restart every 100 requests
4. **Performance:** Slightly higher latency on first request after worker restart (~2-3s for model loading)

## Monitoring in Production

### Memory Metrics Endpoint
```bash
GET http://localhost:8000/api/metrics
```

Response:
```json
{
  "success": true,
  "memory": {
    "rss_mb": 1582.45,
    "vms_mb": 2048.32,
    "percent": 8.2
  },
  "cpu_percent": 12.5,
  "num_threads": 8
}
```

### Key Metrics to Watch
- **rss_mb:** Actual physical memory used (should stay < 1800 MB)
- **percent:** Percentage of total system memory
- **Worker restarts:** Check logs for "Worker exited" messages every ~100 requests

## Troubleshooting

### If Memory Still Growing
1. Reduce `max_requests` in gunicorn.conf.py (try 50)
2. Lower Docker memory limit to fail faster
3. Check metrics endpoint to identify when growth occurs
4. Review logs for any new error patterns

### If Image Still Too Large
1. Check what files are being copied: `docker build --no-cache --progress=plain .`
2. Verify .dockerignore is being used
3. Ensure no large files in Licence-Plate-Detection-Recognition-Recording/
4. Consider using .dockerignore exclusions in build context

### Performance Considerations
- Worker restarts add ~2-3s latency every 100 requests (model reload)
- Adjust `max_requests` based on traffic patterns and memory growth rate
- For high traffic, consider external model serving instead of in-process

## Additional Optimizations (Future)

### Optional Further Reductions
1. **Model Quantization:** Convert YOLO/PaddleOCR models to INT8 (~50% size reduction)
2. **ONNX Runtime:** Use ONNX instead of PyTorch for inference (~30% memory reduction)
3. **Separate Model Server:** Use Triton or TorchServe for model serving
4. **Alpine Base:** Switch from python:3.10-slim to alpine (harder, breaks many deps)

### Monitoring Improvements
1. Add Prometheus metrics exporter
2. Set up Grafana dashboards for memory trends
3. Configure alerts for memory thresholds
4. Log memory stats on each request in production

---

## Files Modified

1. [.dockerignore](.dockerignore) - Added LPD-specific exclusions
2. [Dockerfile.lpd](Dockerfile.lpd) - Added env vars, switched to gunicorn
3. [docker-compose.partial.yml](docker-compose.partial.yml) - Added memory limits
4. [requirements-prod.txt](Licence-Plate-Detection-Recognition-Recording/requirements-prod.txt) - Added gunicorn & psutil
5. [licence_plate_detection.py](Licence-Plate-Detection-Recognition-Recording/detections/licence_plate_detection.py) - Fixed duplication, added cleanup
6. [api_server.py](Licence-Plate-Detection-Recognition-Recording/api_server.py) - Added cleanup & metrics endpoint

## Files Created

1. [gunicorn.conf.py](Licence-Plate-Detection-Recognition-Recording/gunicorn.conf.py) - Production server configuration

---

**Implementation Date:** December 19, 2025
**Status:** ✅ Complete - Ready for rebuild and testing
