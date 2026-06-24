"""OCR + Normalizer evaluation runner.

For each OCR val crop:
1. Run stage2 read_plate_v8 → raw text
2. Apply PlateNormalizer.sanitize → normalized text
3. Reconstruct GT from label file
4. Compute canonicalized exact-match + CER for both raw and normalized
5. Write per-sample rows to results/ocr_eval.csv

Usage:
    python -m evaluation.ocr_normalizer_eval [--limit N]
"""

import argparse
import csv
import sys
import time
from pathlib import Path
from typing import Dict, List, Optional

import cv2
import numpy as np

from evaluation.eval_config import EvalConfig
from evaluation.gt_reconstruction import reconstruct_from_file
from evaluation.metrics import canonicalize, cer, exact_match


def load_ocr_model(model_path: Path):
    """Load stage2 YOLO model for OCR inference.

    Returns:
        (model, names) tuple.
    """
    from ultralytics import YOLO

    model = YOLO(str(model_path))
    model.to("cpu")
    model.conf = 0.60
    model.iou = 0.45
    return model, model.names


def read_plate_v8(model, image: np.ndarray) -> str:
    """Run OCR on a cropped plate image using the same logic as helper.read_plate_v8.

    This is a self-contained copy of the pipeline's OCR assembly logic to avoid
    import-path gymnastics with repo5.

    Returns:
        Assembled plate string, or "unknown" if detection fails.
    """
    results = model(image)
    r = results[0]

    if r.boxes is None or len(r.boxes) == 0:
        return "unknown"

    bb_list = r.boxes.data.tolist()
    names = r.names

    if len(bb_list) < 7 or len(bb_list) > 10:
        return "unknown"

    center_list = []
    y_sum = 0
    for bb in bb_list:
        x_c = (bb[0] + bb[2]) / 2
        y_c = (bb[1] + bb[3]) / 2
        y_sum += y_c
        char = names[int(bb[5])]
        center_list.append([x_c, y_c, char])

    # Determine plate type (1-line vs 2-line) via point-to-line check
    lp_type = "1"
    l_point = min(center_list, key=lambda c: c[0])
    r_point = max(center_list, key=lambda c: c[0])
    if l_point[0] != r_point[0]:
        for ct in center_list:
            if not _check_point_linear(
                ct[0], ct[1],
                l_point[0], l_point[1],
                r_point[0], r_point[1],
            ):
                lp_type = "2"
                break

    y_mean = int(y_sum / len(bb_list))

    license_plate = ""
    if lp_type == "2":
        line_1 = [c for c in center_list if int(c[1]) <= y_mean]
        line_2 = [c for c in center_list if int(c[1]) > y_mean]
        for c in sorted(line_1, key=lambda x: x[0]):
            license_plate += str(c[2])
        license_plate += "-"
        for c in sorted(line_2, key=lambda x: x[0]):
            license_plate += str(c[2])
    else:
        for c in sorted(center_list, key=lambda x: x[0]):
            license_plate += str(c[2])

    return license_plate


def _check_point_linear(x, y, x1, y1, x2, y2) -> bool:
    """Check if point (x,y) lies on the line through (x1,y1)-(x2,y2)."""
    import math
    if x1 == x2:
        return math.isclose(x, x1, abs_tol=3)
    b = y1 - (y2 - y1) * x1 / (x2 - x1)
    a = (y1 - b) / x1 if x1 != 0 else 0
    y_pred = a * x + b
    return math.isclose(y_pred, y, abs_tol=3)


def build_eval_row(
    filename: str,
    raw_text: str,
    gt_text: str,
    normalizer_fn,
) -> dict:
    """Build a single evaluation row comparing raw vs normalized against GT.

    Args:
        filename: Image/label stem name.
        raw_text: Raw OCR output from read_plate_v8.
        gt_text: Reconstructed ground-truth plate string.
        normalizer_fn: Callable that takes raw_text → normalized string.

    Returns:
        Dict with all per-sample fields for the CSV.
    """
    norm_text = normalizer_fn(raw_text)

    gt_core = canonicalize(gt_text)
    raw_core = canonicalize(raw_text)
    norm_core = canonicalize(norm_text)

    raw_match = raw_core == gt_core
    norm_match = norm_core == gt_core
    raw_cer = cer(raw_core, gt_core)
    norm_cer = cer(norm_core, gt_core)

    return {
        "filename": filename,
        "gt_plate": gt_text,
        "gt_core": gt_core,
        "raw_text": raw_text,
        "raw_core": raw_core,
        "norm_text": norm_text,
        "norm_core": norm_core,
        "raw_match": raw_match,
        "norm_match": norm_match,
        "raw_cer": round(raw_cer, 4),
        "norm_cer": round(norm_cer, 4),
    }


def get_paired_files(images_dir: Path, labels_dir: Path) -> List[tuple]:
    """Find image-label pairs (matched by stem name).

    Returns:
        List of (image_path, label_path) tuples.
    """
    label_stems = {lf.stem: lf for lf in labels_dir.glob("*.txt")}
    pairs = []
    for img_path in sorted(images_dir.glob("*.jpg")):
        if img_path.stem in label_stems:
            pairs.append((img_path, label_stems[img_path.stem]))
    return pairs


def write_eval_csv(rows: List[dict], output_path: Path) -> None:
    """Write evaluation results to CSV."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = [
        "filename", "gt_plate", "gt_core", "raw_text", "raw_core",
        "norm_text", "norm_core", "raw_match", "norm_match", "raw_cer", "norm_cer",
    ]
    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def main():
    parser = argparse.ArgumentParser(description="OCR + Normalizer evaluation")
    parser.add_argument("--limit", type=int, default=None, help="Limit samples (for quick test)")
    parser.add_argument("--output", type=str, default=None, help="Output CSV path")
    args = parser.parse_args()

    cfg = EvalConfig.from_env()

    if not cfg.stage2_model_path.exists():
        print(f"ERROR: Stage2 model not found at {cfg.stage2_model_path}")
        sys.exit(1)

    # Load model
    print(f"Loading OCR model from: {cfg.stage2_model_path}")
    model, names = load_ocr_model(cfg.stage2_model_path)

    # Load normalizer
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    from services.plate_normalizer import PlateNormalizer
    normalizer_fn = PlateNormalizer.sanitize

    # Find paired files
    pairs = get_paired_files(cfg.ocr_images_dir, cfg.ocr_labels_dir)
    if not pairs:
        print(f"ERROR: No image-label pairs found in {cfg.ocr_images_dir}")
        sys.exit(1)

    if args.limit:
        pairs = pairs[:args.limit]

    print(f"Evaluating {len(pairs)} samples...")
    start_time = time.time()

    rows = []
    skipped = 0
    for i, (img_path, label_path) in enumerate(pairs):
        # Load image
        image = cv2.imread(str(img_path))
        if image is None:
            skipped += 1
            continue

        # Run OCR
        raw_text = read_plate_v8(model, image)

        # Reconstruct GT
        gt_text = reconstruct_from_file(label_path, names)

        # Build row (skip "unknown" OCR results — they indicate detection failure)
        if raw_text == "unknown":
            row = build_eval_row(img_path.stem, "", gt_text, normalizer_fn)
        else:
            row = build_eval_row(img_path.stem, raw_text, gt_text, normalizer_fn)

        rows.append(row)

        if (i + 1) % 100 == 0:
            print(f"  Processed {i + 1}/{len(pairs)}...")

    elapsed = time.time() - start_time

    # Write results
    if args.output:
        output_path = Path(args.output)
    else:
        cfg.ensure_output_dir()
        output_path = cfg.output_dir / "ocr_eval.csv"

    write_eval_csv(rows, output_path)

    # Print summary
    total = len(rows)
    raw_matches = sum(1 for r in rows if r["raw_match"])
    norm_matches = sum(1 for r in rows if r["norm_match"])
    improved = sum(1 for r in rows if not r["raw_match"] and r["norm_match"])
    regressed = sum(1 for r in rows if r["raw_match"] and not r["norm_match"])

    print(f"\n=== OCR + Normalizer Evaluation Results ===")
    print(f"  Total samples:     {total}")
    print(f"  Skipped (bad img): {skipped}")
    print(f"  Time elapsed:      {elapsed:.1f}s")
    print(f"  Raw exact-match:   {raw_matches}/{total} ({100*raw_matches/max(total,1):.1f}%)")
    print(f"  Norm exact-match:  {norm_matches}/{total} ({100*norm_matches/max(total,1):.1f}%)")
    print(f"  Improved by norm:  {improved}")
    print(f"  Regressed by norm: {regressed}")
    print(f"\n  Results written to: {output_path}")


if __name__ == "__main__":
    main()
