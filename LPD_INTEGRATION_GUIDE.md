# LPD (License Plate Detection) Integration Guide

## Overview

This guide describes the integration of License Plate Detection (LPD) into the parking lot employee check-in flow. The feature allows employees to automatically detect license plates using a webcam instead of manually typing them.

## Architecture

### Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (Next.js)                       │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  1. User clicks "Scan" button                                │
│  2. WebcamFeed component opens camera                        │
│  3. User captures image of license plate                     │
│  4. Base64 image sent to backend                             │
│                                                               │
└────────────────┬────────────────────────────────────────────┘
                 │ POST /api/employee/parking/lpd-detect
                 │ { image: base64String }
                 ↓
┌─────────────────────────────────────────────────────────────┐
│                    Backend (Node.js/Express)                 │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  • Validates base64 image                                    │
│  • Calls Python LPD service via HTTP                         │
│  • Returns detected normalized plate                         │
│                                                               │
└────────────────┬────────────────────────────────────────────┘
                 │ POST http://localhost:5000/api/detect
                 │ { image: base64String }
                 ↓
┌─────────────────────────────────────────────────────────────┐
│            Python LPD Service                                │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  • YOLO: Detects license plate location                      │
│  • PaddleOCR: Recognizes plate text                          │
│  • Normalizer: Formats plate (e.g., "51G-39466")             │
│  • Returns detected_plate & confidence score                 │
│                                                               │
└────────────────┬────────────────────────────────────────────┘
                 │ Response: { success: true, normalized_plate, confidence }
                 ↓
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (Next.js)                       │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  5. Auto-populate license_plate form field                   │
│  6. Show "Auto-detected" badge                               │
│  7. User confirms vehicle type                               │
│  8. User clicks "Check In Vehicle" button                    │
│                                                               │
└────────────────┬────────────────────────────────────────────┘
                 │ POST /api/employee/parking/entry
                 │ { license_plate, vehicle_type }
                 ↓
┌─────────────────────────────────────────────────────────────┐
│                    Backend (Node.js/Express)                 │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  • Validates license plate format                            │
│  • Checks lot capacity                                       │
│  • Creates parking session                                   │
│  • Generates ticket                                          │
│  • Returns ticket details                                    │
│                                                               │
└────────────────┬────────────────────────────────────────────┘
                 │ Response: { success: true, ticket }
                 ↓
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (Next.js)                       │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  9. Display ticket confirmation                              │
│  10. User can print ticket                                   │
│  11. Flow complete ✓                                         │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## Project Structure

### Backend Changes

```
be/
├── controllers/
│   └── employee.lpd.controller.js       (NEW) LPD API endpoint handler
├── services/
│   └── employee.lpd.service.js          (NEW) Python service integration
├── routes/
│   └── employee.routes.js               (MODIFIED) Add LPD route
├── __tests__/
│   ├── employee.lpd.controller.test.js  (NEW) Controller tests
│   ├── employee.lpd.service.test.js     (NEW) Service tests
│   └── integration/
│       └── lpd-checkin.integration.test.js (NEW) Integration tests
├── package.json                         (MODIFIED) Add dependencies
└── .env.example                         (NEW) Configuration template
```

### Frontend Changes

```
fe/
├── app/
│   ├── api/
│   │   └── employee.lpd.client.js       (NEW) LPD API client
│   ├── components/
│   │   └── common/
│   │       └── WebcamFeed.jsx           (NEW) Camera component
│   └── employee/
│       └── checkin/
│           └── page.jsx                 (MODIFIED) Integrated LPD
└── __tests__/
    ├── api/
    │   └── employee.lpd.client.test.js  (NEW) API client tests
    └── components/
        └── WebcamFeed.test.js           (NEW) Camera component tests
```

## Setup Instructions

### Prerequisites

- Node.js 16+
- Python 3.8+ with YOLO + PaddleOCR installed
- npm or yarn
- Webcam-enabled device

### 1. Backend Setup

#### Install Dependencies

```bash
cd be
npm install
```

This adds:
- `axios`: HTTP client for calling Python LPD service
- `jest`: Testing framework
- `supertest`: HTTP testing library

#### Configure Environment

Create `.env` file from template:

```bash
cp .env.example .env
```

Update these values:

```env
# LPD Service Configuration
LPD_SERVICE_URL=http://localhost:5000
LPD_TIMEOUT=30000
LPD_ENABLED=true
```

**Important**: The Python LPD service should be running on `localhost:5000` before starting the backend server.

#### Run Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test employee.lpd.controller.test.js

# Run with coverage
npm run test:coverage
```

### 2. Frontend Setup

No additional dependencies needed. Uses native browser APIs:
- `getUserMedia()`: Camera access
- `Canvas API`: Image capture

#### Build & Run

```bash
cd fe
npm run dev
```

Frontend will be available at `http://localhost:3000`

### 3. Python LPD Service Setup

The LPD service is in the `Licence-Plate-Detection-Recognition-Recording` directory.

#### Install Python Dependencies

```bash
cd Licence-Plate-Detection-Recognition-Recording
pip install -r requirements.txt
```

#### Start LPD Service (Port 5000)

Create a wrapper script to start the Python service:

```bash
# Create start_lpd_service.py
python -m services.plate_capture_service --host 0.0.0.0 --port 5000
```

Or run the existing test suite:

```bash
python -m pytest tests/unit/ -v
```

## API Reference

### Backend Endpoint: License Plate Detection

**Endpoint**: `POST /api/employee/parking/lpd-detect`

**Authentication**: Required (Employee role)

**Request Body**:
```json
{
  "image": "data:image/jpeg;base64,iVBORw0KGgo..."
}
```

**Response (200 - Success)**:
```json
{
  "success": true,
  "data": {
    "normalized_plate": "51G-39466",
    "raw_text": "51G-394.66",
    "confidence": 0.95
  }
}
```

**Error Responses**:

- **400**: Invalid image format
  ```json
  {
    "success": false,
    "message": "Invalid image format or encoding"
  }
  ```

- **401**: Not authenticated
  ```json
  {
    "success": false,
    "message": "Unauthorized: User not authenticated"
  }
  ```

- **422**: Plate not detected
  ```json
  {
    "success": false,
    "message": "No license plate detected in image"
  }
  ```

- **500**: Internal error
  ```json
  {
    "success": false,
    "message": "Failed to process license plate detection"
  }
  ```

### Frontend Components

#### WebcamFeed Component

```jsx
import WebcamFeed from '@/components/common/WebcamFeed';

<WebcamFeed
  onCapture={(base64Image) => {
    // Handle captured image
  }}
  isLoading={false}
  onError={(errorMessage) => {
    // Handle errors
  }}
/>
```

**Props**:
- `onCapture`: Callback function with base64 image data
- `isLoading`: Boolean to disable UI during processing
- `onError`: Callback for error messages

#### LPD Client Service

```javascript
import { detectLicensePlate } from '@/api/employee.lpd.client';

try {
  const result = await detectLicensePlate(base64ImageData);
  console.log(result.normalized_plate); // "51G-39466"
  console.log(result.confidence);       // 0.95
} catch (error) {
  console.error(error.message);
}
```

## User Flow

### Check-In with LPD

1. **Navigate to Check-In**: Employee visits `/employee/checkin`

2. **Open Camera**:
   - Click "Scan" button
   - Grant camera permissions (first time)
   - Live video feed appears

3. **Capture Plate**:
   - Point camera at vehicle license plate
   - Wait for yellow box to align with plate
   - Click "Capture License Plate" button
   - Shows spinner while processing

4. **Auto-Population**:
   - License plate field auto-fills (e.g., "51G-39466")
   - "Auto-detected" badge appears
   - Green checkmark confirms detection

5. **Confirm Details**:
   - Select vehicle type (Car or Motorcycle)
   - Review auto-detected plate
   - Can manually edit if needed

6. **Submit**:
   - Click "Check In Vehicle" button
   - Ticket displays with session ID

7. **Print**:
   - Click "Print" button to print ticket
   - Provide to customer

### Fallback (Manual Entry)

If plate detection fails:
1. Error message shows reason
2. User can manually type plate in field
3. Proceed with normal check-in flow

## Testing

### Running Tests

```bash
# Backend tests
cd be
npm test

# Frontend tests
cd fe
npm test

# Run specific test suite
npm test employee.lpd.controller.test.js

# Watch mode
npm test:watch

# Coverage report
npm run test:coverage
```

### Test Coverage

**Backend**:
- ✅ LPD Controller: Request validation, error handling, authentication
- ✅ LPD Service: Base64 validation, HTTP calls to Python service, error mapping
- ✅ Integration: Complete flow from capture to check-in

**Frontend**:
- ✅ WebcamFeed: Permission handling, capture flow, cleanup
- ✅ LPD Client: API calls, error handling, response validation
- ✅ Check-In Page: Form integration, LPD flow

### Test Examples

**Backend Controller Test**:
```javascript
it('should detect license plate from base64 image successfully', async () => {
  const result = await detectLicensePlate(mockBase64, mockReq, mockRes);
  expect(mockRes.status).toHaveBeenCalledWith(200);
  expect(mockRes.json).toHaveBeenCalledWith({
    success: true,
    data: expect.objectContaining({
      normalized_plate: '51G-39466'
    })
  });
});
```

**Frontend Component Test**:
```javascript
it('should call onCapture with base64 image when capture button is clicked', async () => {
  fireEvent.click(screen.getByText('Capture License Plate'));
  await waitFor(() => {
    expect(mockOnCapture).toHaveBeenCalledWith(
      expect.stringContaining('data:image/jpeg')
    );
  });
});
```

## Configuration

### Environment Variables

**Backend (.env)**:
```env
# Required
LPD_SERVICE_URL=http://localhost:5000
LPD_TIMEOUT=30000
LPD_ENABLED=true

# Optional
NODE_ENV=development
PORT=8000
```

### LPD Service Configuration

**Python Service (.env or config)**:
```python
mode: "camera"           # or "image"
dry_run: False           # Set to True to skip posting to backend
save_images: True        # Save captured images for debugging
output_dir: "outputs"    # Directory for saved images
```

## Troubleshooting

### Camera Not Accessible

**Problem**: "Camera permission denied" error

**Solutions**:
1. Check browser permissions (Chrome > Settings > Privacy > Camera)
2. Use HTTPS in production (required for getUserMedia)
3. Check device permissions (macOS/Linux: Grant permission)
4. Try a different browser

### Plate Detection Failing

**Problem**: "No license plate detected in image"

**Solutions**:
1. Ensure plate is clearly visible and well-lit
2. Position plate within yellow box on camera
3. Use consistent lighting (avoid glare)
4. Check Python LPD service is running
5. Verify `LPD_SERVICE_URL` in backend .env

### Python Service Not Responding

**Problem**: "LPD service unavailable" error

**Solutions**:
1. Verify Python service is running on port 5000:
   ```bash
   lsof -i :5000  # Check what's running
   ```
2. Check service logs for errors
3. Verify `requirements.txt` installed correctly
4. Test Python service directly:
   ```bash
   curl http://localhost:5000/health
   ```

### Base64 Image Too Large

**Problem**: Image data exceeds server limits

**Solutions**:
1. Reduce image quality (JPEG compression)
2. Reduce image dimensions (1280x720 or lower)
3. Increase server request size limit in Express:
   ```javascript
   app.use(express.json({ limit: '10mb' }));
   ```

## Performance Optimization

### Frontend

- **Camera Feed**: Optimized resolution (1280x720) for balance
- **Image Capture**: 95% JPEG quality reduces size while maintaining clarity
- **Error Recovery**: Retry detection with different angles/lighting

### Backend

- **Service Integration**: Connection pooling for Python service calls
- **Caching**: Consider caching detection results for identical images
- **Timeout**: 30-second timeout prevents hanging requests

### Python Service

- **Model Loading**: Load YOLO/PaddleOCR once at startup
- **Batch Processing**: Queue multiple detection requests
- **Resource Limits**: Monitor memory usage with large images

## Security Considerations

### Authentication

- ✅ All LPD endpoints require employee authentication
- ✅ Session validation before processing images

### Image Data

- ⚠️ Base64 images stored in request logs (be careful with logging)
- ✅ Images not persisted by default
- ✅ HTTPS in production for data in transit

### Rate Limiting

Consider adding rate limiting:

```javascript
const rateLimit = require('express-rate-limit');

const lpdLimiter = rateLimit({
  windowMs: 60 * 1000,     // 1 minute
  max: 30,                 // 30 requests per minute
  message: 'Too many detection requests'
});

router.post('/parking/lpd-detect', lpdLimiter, lpdController.detectLicensePlate);
```

## Deployment

### Production Checklist

- [ ] Python LPD service running in Docker container
- [ ] Backend `LPD_SERVICE_URL` points to correct service URL
- [ ] HTTPS enabled (required for camera access)
- [ ] Rate limiting configured
- [ ] Error logging configured
- [ ] Tests passing (npm test)
- [ ] Environment variables configured
- [ ] Database migrations done
- [ ] Cache warming for ML models

### Docker Setup (Optional)

Create `Dockerfile` for Python LPD service:

```dockerfile
FROM python:3.9-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

EXPOSE 5000
CMD ["python", "-m", "services.plate_capture_service", "--host", "0.0.0.0", "--port", "5000"]
```

Start with Docker Compose:

```yaml
version: '3.8'
services:
  lpd-service:
    build: ./Licence-Plate-Detection-Recognition-Recording
    ports:
      - "5000:5000"
    environment:
      - PYTHONUNBUFFERED=1

  backend:
    build: ./be
    ports:
      - "8000:8000"
    environment:
      - LPD_SERVICE_URL=http://lpd-service:5000
    depends_on:
      - lpd-service
```

## Monitoring & Logging

### Recommended Logging

```javascript
// Log successful detections
logger.info('Plate detected', {
  plate: '51G-39466',
  confidence: 0.95,
  userId: req.session.user.user_id,
  timestamp: new Date()
});

// Log errors
logger.error('LPD detection failed', {
  error: error.message,
  userId: req.session.user.user_id,
  timestamp: new Date()
});
```

### Metrics to Track

- Detection success rate
- Average confidence score
- API response time
- Camera access denial rate
- Fallback to manual entry rate

## Future Enhancements

1. **Multiple Detection Attempts**: Retry with different angles/lighting
2. **Confidence Threshold**: Skip check-in if confidence below threshold
3. **Plate Preview**: Show detected plate with bounding box overlay
4. **Batch Detection**: Process multiple plates at once
5. **Machine Learning**: Train model on site-specific plate formats
6. **Analytics Dashboard**: Track detection success metrics
7. **Mobile App**: Native iOS/Android support for camera access
8. **Barcode Scanning**: Fallback to QR/barcode scanning
9. **Offline Mode**: Cache detected plates for offline operation
10. **Voice Confirmation**: Audio feedback for successful detection

## Support & Contact

For issues or questions:
1. Check troubleshooting section above
2. Review test files for usage examples
3. Check backend/frontend logs for detailed errors
4. Verify Python service is running and accessible

---

**Last Updated**: December 5, 2025
**Version**: 1.0.0
**Status**: Production Ready
