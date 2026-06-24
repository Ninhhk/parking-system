"""Detection evaluation runner.

Generates a data.yaml pointing at the LP_detection dataset, runs
YOLO model.val() on stage1, captures mAP@0.5, precision, recall,
and writes results to results/detection_eval.json.

Usage:
    python -m evaluation.detection_eval
"""

import json
import sys
import tempfile
from pathlib import Path

import yaml

from evaluation.eval_config import EvalConfig


def generate_data_yaml(
    images_dir: Path,
    labels_dir: Path,
    output_path: Path,
) -> Path:
    """Generate a YOLO data.yaml for detection validation.

    Args:
        images_dir: Path to val images directory.
        labels_dir: Path to val labels directory (unused directly —
                    YOLO infers labels from images path by convention,
                    but we set val to the images dir).
        output_path: Where to write the yaml file.

    Returns:
        Path to the written yaml file.
    """
    # YOLO expects the data.yaml to point at the images directory.
    # It automatically looks for labels in a sibling 'labels' dir.
    # We need to point 'val' at the parent of images/val so YOLO
    # resolves images/val and labels/val correctly.
    dataset_root = images_dir.parent.parent  # e.g., LP_detection/LP_detection/

    data = {
        "path": str(dataset_root),
        "train": str(Path("images") / "val"),  # Required by YOLO even for val-only
        "val": str(Path("images") / "val"),
        "nc": 1,
        "names": ["license_plate"],
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        yaml.dump(data, f, default_flow_style=False)

    return output_path


def run_detection_val(model_path: Path, data_yaml: Path) -> dict:
    """Run YOLO model.val() and extract key metrics.

    Returns:
        Dict with mAP50, mAP50_95, precision, recall, num_images.
    """
    from ultralytics import YOLO

    model = YOLO(str(model_path))
    results = model.val(data=str(data_yaml), verbose=False)

    # results.results_dict contains the metrics
    metrics = {
        "mAP50": float(results.results_dict.get("metrics/mAP50(B)", 0.0)),
        "mAP50_95": float(results.results_dict.get("metrics/mAP50-95(B)", 0.0)),
        "precision": float(results.results_dict.get("metrics/precision(B)", 0.0)),
        "recall": float(results.results_dict.get("metrics/recall(B)", 0.0)),
    }

    return metrics


def write_results(metrics: dict, output_path: Path) -> None:
    """Write detection evaluation results to JSON."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(metrics, f, indent=2)


def main():
    cfg = EvalConfig.from_env()

    if not cfg.stage1_model_path.exists():
        print(f"ERROR: Stage1 model not found at {cfg.stage1_model_path}")
        print("Place license_plate_detector.pt in repo5/model/ before running.")
        sys.exit(1)

    if not cfg.det_images_dir.exists():
        print(f"ERROR: Detection images dir not found: {cfg.det_images_dir}")
        sys.exit(1)

    cfg.ensure_output_dir()

    # Generate data.yaml
    data_yaml_path = cfg.output_dir / "detection_data.yaml"
    print(f"Generating data.yaml at: {data_yaml_path}")
    generate_data_yaml(cfg.det_images_dir, cfg.det_labels_dir, data_yaml_path)

    # Run validation
    print(f"Running detection validation with model: {cfg.stage1_model_path}")
    print(f"Dataset: {cfg.det_images_dir}")
    metrics = run_detection_val(cfg.stage1_model_path, data_yaml_path)

    # Write results
    output_path = cfg.output_dir / "detection_eval.json"
    write_results(metrics, output_path)

    print(f"\n=== Detection Evaluation Results ===")
    print(f"  mAP@0.5:      {metrics['mAP50']:.4f}")
    print(f"  mAP@0.5:0.95: {metrics['mAP50_95']:.4f}")
    print(f"  Precision:     {metrics['precision']:.4f}")
    print(f"  Recall:        {metrics['recall']:.4f}")
    print(f"\n  Results written to: {output_path}")


if __name__ == "__main__":
    main()
