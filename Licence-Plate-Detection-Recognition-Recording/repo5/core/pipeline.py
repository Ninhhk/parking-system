"""
core/pipeline.py — Shared inference pipeline for repo5 LPR system (Plan B).

Accepts model objects as parameters (dependency injection) so that alternative
models can be substituted in tests or future plans (Plan C).
No intermediate disk I/O: crops are passed in-memory throughout.
"""

from typing import Any

import numpy as np

from function import helper
from function import utils_rotate


def run_pipeline(
    frame: np.ndarray,
    stage1: Any,
    stage2: Any,
) -> list[dict]:
    """Run the full LPR inference pipeline on a single frame.

    Steps:
    1. Call stage1(frame) exactly once; extract boxes via .boxes.data.tolist().
    2. If no detections: call helper.read_plate(stage2, frame) as fallback;
       if result is not "unknown", return it as a single-item list with
       bbox=[0,0,0,0] and confidence=0.0.
    3. For each detection: crop in-memory (frame[y1:y2, x1:x2]),
       call utils_rotate.deskew(crop, cc=0, ct=0),
       call helper.read_plate(stage2, deskewed).
    4. Return list[dict] with keys "text", "bbox", "confidence" per plate,
       skipping entries where text == "unknown".

    Args:
        frame:  BGR numpy array (H×W×3).
        stage1: YOLOv8 YOLO model instance (callable).
        stage2: YOLOv8 YOLO model instance (callable, used via helper.read_plate_v8).

    Returns:
        List of dicts: {"text": str, "bbox": [x1, y1, x2, y2], "confidence": float}
    """
    # Step 1 — Stage 1 inference (called exactly once)
    results = stage1(frame)
    boxes = results[0].boxes.data.tolist()  # [[x1, y1, x2, y2, conf, cls], ...]

    # Step 2 — Fallback: no detections → run OCR on full frame
    if not boxes:
        text = helper.read_plate_v8(stage2, frame)
        if text != "unknown":
            return [{"text": text, "bbox": [0, 0, 0, 0], "confidence": 0.0}]
        return []

    # Step 3 — Process each detected plate crop
    plates: list[dict] = []
    for box in boxes:
        x1, y1, x2, y2, conf, _cls = box
        # Pad crop by 5% on each side to reduce edge-clip OCR errors
        h, w = frame.shape[:2]
        pad_x = int((x2 - x1) * 0.05)
        pad_y = int((y2 - y1) * 0.05)
        cx1 = max(0, int(x1) - pad_x)
        cy1 = max(0, int(y1) - pad_y)
        cx2 = min(w, int(x2) + pad_x)
        cy2 = min(h, int(y2) + pad_y)
        crop = frame[cy1:cy2, cx1:cx2]
        # Single deskew call (cc=0, ct=0)
        deskewed = utils_rotate.deskew(crop, change_cons=0, center_thres=0)
        text = helper.read_plate_v8(stage2, deskewed)
        if text != "unknown":
            plates.append({
                "text": text,
                "bbox": [x1, y1, x2, y2],
                "confidence": conf,
            })

    return plates
