"""Evaluation configuration — resolves dataset paths and output directory.

Paths default to the known local test sets on the developer machine.
Override via environment variables for portability.
"""

import os
from dataclasses import dataclass, field
from pathlib import Path


@dataclass(frozen=True)
class EvalConfig:
    """Immutable evaluation configuration."""

    # OCR dataset: cropped plate images + per-character YOLO labels
    ocr_images_dir: Path
    ocr_labels_dir: Path

    # LP detection dataset: full scene images + plate-level YOLO labels
    det_images_dir: Path
    det_labels_dir: Path

    # Output directory for results
    output_dir: Path

    # Stage2 model path (for OCR inference)
    stage2_model_path: Path

    # Stage1 model path (for detection eval)
    stage1_model_path: Path

    @classmethod
    def from_env(cls) -> "EvalConfig":
        """Build config from environment variables with sensible defaults."""
        ocr_base = Path(
            os.getenv("EVAL_OCR_DATASET", r"D:\test YOLO\OCR\OCR")
        )
        det_base = Path(
            os.getenv("EVAL_DET_DATASET", r"D:\test YOLO\LP_detection\LP_detection")
        )
        output = Path(
            os.getenv(
                "EVAL_OUTPUT_DIR",
                str(Path(__file__).resolve().parent / "results"),
            )
        )
        repo5_model = Path(__file__).resolve().parent.parent / "repo5" / "model"
        stage1 = Path(
            os.getenv(
                "EVAL_STAGE1_MODEL",
                str(repo5_model / "license_plate_detector.pt"),
            )
        )
        stage2 = Path(
            os.getenv(
                "EVAL_STAGE2_MODEL",
                str(repo5_model / "LP_ocr_yolov8.pt"),
            )
        )

        return cls(
            ocr_images_dir=ocr_base / "images" / "val",
            ocr_labels_dir=ocr_base / "labels" / "val",
            det_images_dir=det_base / "images" / "val",
            det_labels_dir=det_base / "labels" / "val",
            output_dir=output,
            stage2_model_path=stage2,
            stage1_model_path=stage1,
        )

    def ensure_output_dir(self) -> None:
        """Create output directory if it doesn't exist."""
        self.output_dir.mkdir(parents=True, exist_ok=True)
