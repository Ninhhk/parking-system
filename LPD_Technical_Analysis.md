# LPD Technical Analysis

**Updated:** 2026-05-03  
**Source:** repo5 research (LPR_FINDINGS.md, BENCHMARK_REPORT_PLANB.md)

## Migration: PaddleOCR → YOLOv8 Two-Stage

The previous implementation used a single YOLOv8 detector for plate localisation and PaddleOCR for text reading. This has been replaced with a two-stage YOLOv8-only pipeline.

| | Old (PaddleOCR) | New (Plan B) |
|---|---|---|
| Stage 1 | YOLOv8 `best.pt` | YOLOv8 `best.pt` (unchanged) |
| Stage 2 | PaddleOCR (general OCR) | YOLOv8n `LP_ocr_yolov8.pt` (Vietnamese-specific) |
| Dependency | `paddleocr`, `paddlepaddle` | `ultralytics` only |
| Character set | General text | 30-class Vietnamese plate chars |
| Deskew | None | Hough-line deskew before OCR |

## Stage 2 Model — train-7

- Architecture: YOLOv8n (nano), 3.0M params
- Training: 90/100 epochs on RTX 3060, stopped early due to VRAM OOM; `best.pt` saved at peak
- Dataset: 3,066 real Vietnamese plate images, 767 val
- mAP@.5: **0.982** | Precision: 0.975 | Recall: 0.974
- Class mapping (critical — order matters):
  ```
  index 0 = '1', index 1 = '2', ..., index 28 = 'Z', index 29 = '0'
  ```
- Benchmark vs YOLOv5 reference: **11/16 (69%)** on 16 test images

## Why YOLOv8 OCR beats PaddleOCR for this use case

PaddleOCR is trained on general text. Vietnamese plates use a restricted 30-character set and specific fonts. A domain-specific YOLOv8n trained on real plate crops:
- Knows the exact character set (no `I/1`, `O/0`, `S/5` confusion from general OCR)
- Handles two-line plate layout explicitly (sort by y_mean, then x)
- Runs without MKL-DNN or angle classifier overhead

## read_plate_v8 — Key API Difference from YOLOv5

```python
# YOLOv8 (current)
r = results[0]
bb_list = r.boxes.data.tolist()   # [[x1,y1,x2,y2,conf,class_id], ...]
names = r.names                    # {0: '1', 1: '2', ..., 29: '0'}
char = names[int(bb[5])]          # class_id → char string

# YOLOv5 (old — broken with YOLOv8)
bb_list = results.pandas().xyxy[0].values.tolist()
char = bb[-1]  # was a string in YOLOv5, is an int in YOLOv8
```

## Benchmark Results (16 test images, CPU)

| Metric | Value |
|---|---|
| Agreement with YOLOv5 reference | 11/16 (69%) |
| Avg inference time (CPU) | ~205 ms |
| Stage 2 mAP@.5 | 0.982 |

Remaining 5 mismatches:
- `4.jpg`: `5`↔`6` confusion (visual ambiguity, model-level)
- `557.png`: Stage 1 false positive + extra char from padding
- `010805.png`: Extra chars from 5% padding on tight crop
- `010924.png` / `010935.png`: Duplicate char detection (two separate boxes for same char)

## Remaining Improvements (not yet applied)

1. **Duplicate char deduplication** — if two detections share the same class and x-centers are within ~15% of crop width, keep only the higher-confidence one. Fixes `010924` and `010935`.
2. **Adaptive padding** — skip 5% padding when plate crop width > 150px. Fixes `010805`.
3. **Stage 1 conf threshold** — raise from 0.25 to ~0.50 to reduce false positives (`557.png`).
4. **YOLOv8s backbone** — better `5`/`6` discrimination at the cost of ~2× model size.
