# Model Files

Place the following model files in this directory before running the system:

## Stage 1 — YOLOv8 Plate Detector

**File:** `license_plate_detector.pt`

- Source: repo2 (`Automatic_Number_Plate_Detection_Recognition_YOLOv8`)
- Used by: `core/models.py` → `load_stage1()`
- Loaded via: `from ultralytics import YOLO`

## Stage 2 — YOLOv5 Character OCR

**File:** `LP_ocr.pt` (or `LP_ocr_nano_62.pt`)

- Source: repo4 (`License-Plate-Recognition/model/`)
- Used by: `core/models.py` → `load_stage2()`
- Loaded via: `torch.hub.load('yolov5', 'custom', path=..., source='local')`

## Notes

- Model files are NOT committed to the repository (they are large binary files).
- Both models run on CPU — no GPU required.
- The `yolov5/` directory in the repo root provides the local source for `torch.hub.load`.
