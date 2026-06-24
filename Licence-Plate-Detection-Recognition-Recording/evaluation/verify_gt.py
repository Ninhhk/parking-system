"""GT mapping verification helper.

Loads the stage2 model once, extracts model.names, reconstructs GT plate
strings for N random OCR val samples, and writes them to a CSV for human
eyeball verification.

Usage:
    python -m evaluation.verify_gt [--limit 10] [--output results/gt_sample.csv]
"""

import argparse
import csv
import random
import sys
from pathlib import Path

from evaluation.eval_config import EvalConfig
from evaluation.gt_reconstruction import reconstruct_from_file


def load_model_names(model_path: Path) -> dict:
    """Load the stage2 YOLO model and extract the class→char mapping.

    Returns:
        Dict mapping int class_id → str character.
    """
    from ultralytics import YOLO

    model = YOLO(str(model_path))
    return model.names


def get_label_files(labels_dir: Path) -> list:
    """List all .txt label files in the directory."""
    if not labels_dir.exists():
        return []
    return sorted(labels_dir.glob("*.txt"))


def format_sample_rows(
    label_files: list,
    names: dict,
    limit: int,
) -> list:
    """Reconstruct GT for a random sample of label files.

    Args:
        label_files: All available label file paths.
        names: class_id → char mapping.
        limit: Max number of samples.

    Returns:
        List of dicts with keys: filename, reconstructed_plate, num_chars.
    """
    if limit < len(label_files):
        sampled = random.sample(label_files, limit)
    else:
        sampled = label_files

    rows = []
    for lf in sorted(sampled):
        plate = reconstruct_from_file(lf, names)
        rows.append({
            "filename": lf.stem,
            "reconstructed_plate": plate,
            "num_chars": len(plate.replace("-", "")),
        })
    return rows


def write_csv(rows: list, output_path: Path) -> None:
    """Write sample rows to CSV."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["filename", "reconstructed_plate", "num_chars"])
        writer.writeheader()
        writer.writerows(rows)


def print_names_mapping(names: dict) -> None:
    """Print the class→char mapping for reference."""
    print("\n=== Model class → character mapping ===")
    for class_id in sorted(names.keys()):
        print(f"  {class_id:2d} → '{names[class_id]}'")
    print(f"\nTotal classes: {len(names)}\n")


def main():
    parser = argparse.ArgumentParser(description="Verify GT reconstruction mapping")
    parser.add_argument("--limit", type=int, default=10, help="Number of samples")
    parser.add_argument("--output", type=str, default=None, help="Output CSV path")
    parser.add_argument("--print-mapping", action="store_true", help="Print class→char mapping")
    args = parser.parse_args()

    cfg = EvalConfig.from_env()

    if not cfg.stage2_model_path.exists():
        print(f"ERROR: Stage2 model not found at {cfg.stage2_model_path}")
        print("Place LP_ocr_yolov8.pt in repo5/model/ before running.")
        sys.exit(1)

    print(f"Loading model from: {cfg.stage2_model_path}")
    names = load_model_names(cfg.stage2_model_path)

    if args.print_mapping:
        print_names_mapping(names)

    label_files = get_label_files(cfg.ocr_labels_dir)
    if not label_files:
        print(f"ERROR: No label files found in {cfg.ocr_labels_dir}")
        sys.exit(1)

    print(f"Found {len(label_files)} label files in {cfg.ocr_labels_dir}")
    rows = format_sample_rows(label_files, names, args.limit)

    # Determine output path
    if args.output:
        output_path = Path(args.output)
    else:
        cfg.ensure_output_dir()
        output_path = cfg.output_dir / "gt_sample.csv"

    write_csv(rows, output_path)
    print(f"\nWrote {len(rows)} samples to: {output_path}")
    print("\n=== Sample reconstructions (verify against images) ===")
    for row in rows[:10]:
        print(f"  {row['filename']:30s} → {row['reconstructed_plate']}")

    print("\nDone. Open the CSV and spot-check against the actual images.")


if __name__ == "__main__":
    main()
