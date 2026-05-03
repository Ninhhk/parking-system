"""
core/models.py — Isolated model loaders for repo5 LPR system (Plan A).

Both loaders are intentionally isolated so that swapping a model
(Plan B: YOLOv8 OCR, Plan C: ONNX) requires changing only this file.
All inference runs on CPU; no CUDA required.
"""

import os
from typing import Any

import torch
from ultralytics import YOLO


def load_stage1(model_path: str = "model/license_plate_detector.pt") -> YOLO:
    """Load YOLOv8 plate detector on CPU.

    Args:
        model_path: Path to the YOLOv8 .pt weights file.
                    Defaults to "model/license_plate_detector.pt".

    Returns:
        YOLO model instance running on CPU.

    Raises:
        FileNotFoundError: If model_path does not exist on disk.
    """
    if not os.path.exists(model_path):
        raise FileNotFoundError(
            f"Stage 1 model not found at '{model_path}'. "
            "Please place 'license_plate_detector.pt' in the model/ directory. "
            "See model/README.md for instructions."
        )
    model = YOLO(model_path)
    model.to("cpu")
    return model


def load_stage2(model_path: str = "model/LP_ocr_yolov8.pt") -> YOLO:
    """Load YOLOv8 OCR model on CPU (Plan B).

    Args:
        model_path: Path to the YOLOv8 .pt weights file.
                    Defaults to "model/LP_ocr_yolov8.pt".

    Returns:
        YOLO model instance with conf=0.60 and iou=0.45.

    Raises:
        FileNotFoundError: If model_path does not exist on disk.
    """
    if not os.path.exists(model_path):
        raise FileNotFoundError(
            f"Stage 2 model not found at '{model_path}'. "
            "Please place 'LP_ocr_yolov8.pt' in the model/ directory. "
            "See model/README.md for instructions."
        )
    model = YOLO(model_path)
    model.to("cpu")
    model.conf = 0.60
    model.iou = 0.45  # tighter NMS to suppress duplicate character detections
    return model
