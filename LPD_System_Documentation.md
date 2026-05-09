# LPD System Documentation

**Updated:** 2026-05-03

## Overview

The License Plate Detection (LPD) module uses a **YOLOv8 two-stage pipeline** for Vietnamese license plate recognition. PaddleOCR has been removed.

```
Frame → Stage 1 (plate detector) → crop → Stage 2 (character OCR) → plate string
```

## Models

| Stage | File | Purpose |
|---|---|---|
| Stage 1 | `models/best.pt` | YOLOv8 plate detector — finds plate bounding boxes |
| Stage 2 | `models/LP_ocr_yolov8.pt` | YOLOv8n OCR — reads characters from each crop |

Stage 2 (`LP_ocr_yolov8.pt`) is train-7 from repo5: YOLOv8n trained on 3,066 real Vietnamese plate images, 90 epochs, mAP@.5 = 0.982. Class set: 30 characters (`0–9`, `A–Z` minus `I J O Q R W`).

## File Structure

```
Licence-Plate-Detection-Recognition-Recording/
├── detections/
│   └── licence_plate_detection.py   # LicencePlateDetection class (two-stage pipeline)
├── models/
│   ├── best.pt                      # Stage 1 — YOLOv8 plate detector
│   └── LP_ocr_yolov8.pt             # Stage 2 — YOLOv8n OCR (train-7)
├── utils/
│   ├── lpr_helper.py                # read_plate_v8() — char assembly logic
│   └── lpr_utils_rotate.py          # deskew() — plate deskewing
├── services/
│   ├── plate_capture_service.py     # High-level capture + check-in workflow
│   ├── plate_normalizer.py          # Plate string normalisation
│   └── api_client.py                # Backend API client
└── config/
    └── settings.py                  # AppConfig, ModelConfig (plate + OCR paths)
```

## LicencePlateDetection API

```python
from detections.licence_plate_detection import LicencePlateDetection

detector = LicencePlateDetection(
    model_path="models/best.pt",
    ocr_model_path="models/LP_ocr_yolov8.pt"  # optional, auto-resolved if omitted
)

# Single frame — returns parallel lists
bbox_list, text_list = detector.detect_frame(frame)

# Multiple frames
all_bboxes, all_texts = detector.detect_frames(frames)

# Best plate only (for check-in flow)
result = detector.detect_plate_from_frame(frame)
# result = {"success": True, "plate_text": "29B1-25662", "bbox": [...], "confidence": 0.87, "detection_time_ms": 210}
```

## Pipeline Details

1. **Stage 1** — `stage1(frame)` called once. Returns `[[x1,y1,x2,y2,conf,cls], ...]`.
2. **Padding** — each crop is padded 5% on each side to reduce edge-clip OCR errors.
3. **Deskew** — `deskew(crop, change_cons=0, center_thres=0)` corrects plate tilt.
4. **Stage 2** — `read_plate_v8(stage2, deskewed)` assembles the plate string by sorting detected character centers by x (1-line) or splitting by y_mean (2-line Vietnamese plates).
5. **Fallback** — if Stage 1 finds no plates, OCR runs on the full frame.

## Dependencies

Remove from requirements: `paddleocr`, `paddlepaddle`  
Keep / add: `ultralytics`, `opencv-python`, `numpy`

## Known Limitations (from benchmark, 11/16 agreement)

- `5`/`6` confusion on worn plates — model-level, needs more training data or YOLOv8s backbone.
- Duplicate character detection on some plates (e.g., `66C` instead of `6C`) — post-processing deduplication not yet applied.
- Extra characters from 5% padding on tightly-cropped plates — adaptive padding is a future improvement.
