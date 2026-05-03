"""Repo5-based LPD service adapter.

This module keeps the HTTP layer thin and isolates the new repo5 pipeline
behind a small service object so the backend can keep its legacy JSON/base64
contract while also supporting the repo5 multipart API.
"""

from __future__ import annotations

import base64
import binascii
import os
import sys
import time
from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable

import cv2
import numpy as np

from services.plate_normalizer import PlateNormalizer


@dataclass(frozen=True)
class Repo5LPDConfig:
    """Configuration for the repo5 LPD pipeline."""

    stage1_model_path: Path
    stage2_model_path: Path

    @classmethod
    def from_env(cls) -> "Repo5LPDConfig":
        """Load model paths from environment variables."""
        base_dir = Path(__file__).resolve().parent.parent / "repo5"
        return cls(
            stage1_model_path=Path(
                os.getenv(
                    "LPD_STAGE1_MODEL_PATH",
                    str(base_dir / "model" / "license_plate_detector.pt"),
                )
            ),
            stage2_model_path=Path(
                os.getenv(
                    "LPD_STAGE2_MODEL_PATH",
                    str(base_dir / "model" / "LP_ocr_yolov8.pt"),
                )
            ),
        )


@contextmanager
def _repo5_import_path():
    """Temporarily prepend repo5 to sys.path so its flat imports resolve."""
    repo5_root = Path(__file__).resolve().parent.parent / "repo5"
    repo5_path = str(repo5_root)

    if not repo5_root.exists():
        raise FileNotFoundError(
            f"repo5 folder not found at '{repo5_root}'. The new pipeline service is missing."
        )

    already_present = repo5_path in sys.path
    if not already_present:
        sys.path.insert(0, repo5_path)

    try:
        yield
    finally:
        if not already_present and sys.path and sys.path[0] == repo5_path:
            sys.path.pop(0)


class Repo5LPDService:
    """Load and execute the repo5 YOLOv8 two-stage plate pipeline."""

    def __init__(
        self,
        config: Repo5LPDConfig | None = None,
        normalizer: PlateNormalizer | None = None,
        stage1: Any | None = None,
        stage2: Any | None = None,
    ):
        self.config = config or Repo5LPDConfig.from_env()
        self.normalizer = normalizer or PlateNormalizer()
        self._stage1 = stage1
        self._stage2 = stage2
        self._load_error: Exception | None = None

        with _repo5_import_path():
            from core.models import load_stage1, load_stage2
            from core.pipeline import run_pipeline

        self._load_stage1 = load_stage1
        self._load_stage2 = load_stage2
        self._run_pipeline = run_pipeline

    def is_ready(self) -> bool:
        """Return True when both repo5 stages are loaded."""
        return self._stage1 is not None and self._stage2 is not None

    def ensure_ready(self) -> None:
        """Load repo5 models once and cache the result."""
        if self.is_ready():
            return

        if self._load_error is not None:
            raise RuntimeError(str(self._load_error)) from self._load_error

        try:
            self._stage1 = self._load_stage1(str(self.config.stage1_model_path))
            self._stage2 = self._load_stage2(str(self.config.stage2_model_path))
        except Exception as exc:  # pragma: no cover - exercised in integration only
            self._load_error = exc
            raise RuntimeError(f"Failed to initialize repo5 LPD models: {exc}") from exc

    @staticmethod
    def _decode_data_url(image_data: str) -> str:
        if image_data.startswith("data:image") and "," in image_data:
            return image_data.split(",", 1)[1]
        return image_data

    @staticmethod
    def _decode_base64_image(image_data: str) -> np.ndarray:
        try:
            image_bytes = base64.b64decode(image_data, validate=True)
        except (binascii.Error, ValueError) as exc:
            raise ValueError("Failed to decode image: invalid base64 data") from exc

        buffer = np.frombuffer(image_bytes, dtype=np.uint8)
        frame = cv2.imdecode(buffer, cv2.IMREAD_COLOR)
        if frame is None:
            raise ValueError("Failed to decode image: unsupported or corrupted image data")

        return frame

    @staticmethod
    def _validate_frame(frame: np.ndarray) -> None:
        if frame is None or not isinstance(frame, np.ndarray):
            raise ValueError("A valid image frame is required")
        if frame.size == 0:
            raise ValueError("Image data is empty")

    def detect_frame(self, frame: np.ndarray) -> dict:
        """Run the repo5 pipeline on a decoded frame and return structured plates."""
        self._validate_frame(frame)
        self.ensure_ready()

        start = time.perf_counter()
        plates = self._run_pipeline(frame, self._stage1, self._stage2)
        inference_time_ms = (time.perf_counter() - start) * 1000.0

        return {
            "plates": plates,
            "plate_count": len(plates),
            "inference_time_ms": inference_time_ms,
        }

    def detect_best_plate(self, frame: np.ndarray) -> dict:
        """Return the highest-confidence plate in legacy backend format."""
        result = self.detect_frame(frame)
        plates = result["plates"]

        if not plates:
            return {
                "success": False,
                "error": "No license plate detected",
            }

        best_plate = max(plates, key=lambda item: float(item.get("confidence", 0.0)))
        raw_text = str(best_plate.get("text", ""))
        normalized_plate = self.normalizer.sanitize(raw_text)

        if not normalized_plate:
            return {
                "success": False,
                "error": "Failed to normalize detected plate",
            }

        return {
            "success": True,
            "normalized_plate": normalized_plate,
            "raw_text": raw_text,
            "confidence": float(best_plate.get("confidence", 0.0)),
            "bbox": best_plate.get("bbox", [0, 0, 0, 0]),
            "detection_time_ms": result["inference_time_ms"],
        }

    def detect_base64_image(self, image_data: str) -> dict:
        """Decode a base64 image string and detect the best license plate."""
        if not isinstance(image_data, str) or not image_data.strip():
            raise ValueError("Image data is required")

        cleaned = self._decode_data_url(image_data.strip())
        frame = self._decode_base64_image(cleaned)
        return self.detect_best_plate(frame)

    def detect_base64_batch(self, images: Iterable[str]) -> dict:
        """Process a batch of base64-encoded images."""
        results = []
        successful = 0

        for index, image_data in enumerate(images):
            try:
                detection = self.detect_base64_image(image_data)
                if detection.get("success"):
                    successful += 1
                results.append({"image_index": index, **detection})
            except Exception as exc:
                results.append({
                    "image_index": index,
                    "success": False,
                    "error": str(exc),
                })

        return {
            "success": True,
            "total": len(results),
            "successful": successful,
            "results": results,
        }
