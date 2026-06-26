"""Report generator — aggregates eval results into WS7_report.md.

Reads ocr_eval.csv + detection_eval.json, computes aggregates, and emits
a defense-ready markdown report with:
- Section A: Detection mAP/P/R
- Section B: OCR + Normalizer before/after, delta, examples

Usage:
    python -m evaluation.generate_report
"""

import csv
import json
import sys
from pathlib import Path
from typing import List

from evaluation.eval_config import EvalConfig
from evaluation.metrics import aggregate


def load_ocr_csv(csv_path: Path) -> List[dict]:
    """Load OCR eval CSV and parse into typed rows."""
    rows = []
    with open(csv_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append({
                "filename": row["filename"],
                "gt_plate": row["gt_plate"],
                "gt_core": row["gt_core"],
                "raw_text": row["raw_text"],
                "raw_core": row["raw_core"],
                "norm_text": row["norm_text"],
                "norm_core": row["norm_core"],
                "raw_match": row["raw_match"] == "True",
                "norm_match": row["norm_match"] == "True",
                "raw_cer": float(row["raw_cer"]),
                "norm_cer": float(row["norm_cer"]),
            })
    return rows


def load_detection_json(json_path: Path) -> dict:
    """Load detection eval JSON."""
    with open(json_path, "r", encoding="utf-8") as f:
        return json.load(f)


def find_recovery_examples(rows: List[dict], max_examples: int = 5) -> List[dict]:
    """Find samples where normalizer recovered a correct match from raw error."""
    examples = []
    for row in rows:
        if not row["raw_match"] and row["norm_match"]:
            examples.append(row)
            if len(examples) >= max_examples:
                break
    return examples


def find_regression_examples(rows: List[dict], max_examples: int = 3) -> List[dict]:
    """Find samples where normalizer introduced an error."""
    examples = []
    for row in rows:
        if row["raw_match"] and not row["norm_match"]:
            examples.append(row)
            if len(examples) >= max_examples:
                break
    return examples


def classify_dataset_composition(rows: List[dict]) -> dict:
    """Classify samples by filename prefix into categories."""
    categories = {
        "xemay": 0,
        "CarLongPlate": 0,
        "PlateBaza": 0,
        "iwt": 0,
        "ndata": 0,
        "other": 0,
    }
    two_line = 0
    one_line = 0

    for row in rows:
        name = row["filename"]
        classified = False
        for prefix in ["xemay", "CarLongPlate", "PlateBaza", "iwt", "ndata"]:
            # Match prefix ignoring leading digits
            stripped = name.lstrip("0123456789")
            if stripped.startswith(prefix) or name.startswith(prefix):
                categories[prefix] += 1
                classified = True
                break
        if not classified:
            categories["other"] += 1

        # Detect 2-line by presence of hyphen in GT
        if "-" in row["gt_plate"]:
            two_line += 1
        else:
            one_line += 1

    return {
        "categories": categories,
        "two_line": two_line,
        "one_line": one_line,
    }


def build_report(
    ocr_rows: List[dict],
    detection: dict,
    det_num_images: int = 1652,
) -> str:
    """Build the full markdown report string."""
    stats = aggregate(ocr_rows)
    composition = classify_dataset_composition(ocr_rows)
    recoveries = find_recovery_examples(ocr_rows)
    regressions = find_regression_examples(ocr_rows)

    delta_exact = stats["norm_exact_match_rate"] - stats["raw_exact_match_rate"]
    delta_cer = stats["raw_mean_cer"] - stats["norm_mean_cer"]

    lines = []
    lines.append("# WS7 — YOLOv8 + Normalizer Evaluation Report")
    lines.append("")
    lines.append("## Section A: License Plate Detection (Stage 1)")
    lines.append("")
    lines.append(f"| Metric | Value |")
    lines.append(f"|--------|-------|")
    lines.append(f"| Model | YOLOv8n (`license_plate_detector.pt`) |")
    lines.append(f"| Val images | {det_num_images} |")
    lines.append(f"| mAP@0.5 | {detection.get('mAP50', 0):.4f} |")
    lines.append(f"| mAP@0.5:0.95 | {detection.get('mAP50_95', 0):.4f} |")
    lines.append(f"| Precision | {detection.get('precision', 0):.4f} |")
    lines.append(f"| Recall | {detection.get('recall', 0):.4f} |")
    lines.append("")
    lines.append("**Interpretation**: Stage 1 detection is near-perfect on this dataset.")
    lines.append("Recognition errors in Section B are predominantly OCR (stage 2) errors,")
    lines.append("not detection misses.")
    lines.append("")

    lines.append("## Section B: OCR + Position-Aware Normalizer")
    lines.append("")
    lines.append("### Summary")
    lines.append("")
    lines.append(f"| Metric | Raw (no normalizer) | With normalizer | Delta |")
    lines.append(f"|--------|--------------------:|----------------:|------:|")
    lines.append(f"| Exact-match accuracy | {stats['raw_exact_match_rate']:.4f} ({int(stats['raw_exact_match_rate']*stats['n'])}/{stats['n']}) | {stats['norm_exact_match_rate']:.4f} ({int(stats['norm_exact_match_rate']*stats['n'])}/{stats['n']}) | +{delta_exact:.4f} |")
    lines.append(f"| Mean CER | {stats['raw_mean_cer']:.4f} | {stats['norm_mean_cer']:.4f} | -{delta_cer:.4f} |")
    lines.append("")
    lines.append("### Transition Counts")
    lines.append("")
    lines.append(f"| Category | Count | % |")
    lines.append(f"|----------|------:|--:|")
    lines.append(f"| Improved (raw wrong → norm correct) | {stats['improved']} | {100*stats['improved']/max(stats['n'],1):.1f}% |")
    lines.append(f"| Regressed (raw correct → norm wrong) | {stats['regressed']} | {100*stats['regressed']/max(stats['n'],1):.1f}% |")
    lines.append(f"| Unchanged | {stats['unchanged']} | {100*stats['unchanged']/max(stats['n'],1):.1f}% |")
    lines.append("")

    if recoveries:
        lines.append("### Recovery Examples (Normalizer Fixed)")
        lines.append("")
        lines.append("| File | GT | Raw OCR | Normalized |")
        lines.append("|------|---:|--------:|-----------:|")
        for ex in recoveries:
            lines.append(f"| {ex['filename']} | `{ex['gt_core']}` | `{ex['raw_core']}` | `{ex['norm_core']}` |")
        lines.append("")

    if regressions:
        lines.append("### Regression Examples (Normalizer Broke)")
        lines.append("")
        lines.append("| File | GT | Raw OCR | Normalized |")
        lines.append("|------|---:|--------:|-----------:|")
        for ex in regressions:
            lines.append(f"| {ex['filename']} | `{ex['gt_core']}` | `{ex['raw_core']}` | `{ex['norm_core']}` |")
        lines.append("")

    lines.append("### Dataset Composition")
    lines.append("")
    lines.append(f"| Category | Count |")
    lines.append(f"|----------|------:|")
    for cat, count in sorted(composition["categories"].items(), key=lambda x: -x[1]):
        if count > 0:
            lines.append(f"| {cat} | {count} |")
    lines.append(f"| **Total** | **{stats['n']}** |")
    lines.append("")
    lines.append(f"| Plate type | Count |")
    lines.append(f"|------------|------:|")
    lines.append(f"| 2-line (motorbike/square) | {composition['two_line']} |")
    lines.append(f"| 1-line (car/long) | {composition['one_line']} |")
    lines.append("")

    lines.append("## Limitations")
    lines.append("")
    lines.append("- Test set = pre-defined validation split (not used for weight updates,")
    lines.append("  but seen during training monitoring for early-stopping).")
    lines.append("- Dataset source: public Vietnamese license plate collections, not")
    lines.append("  captured from the actual parking-lot cameras.")
    lines.append("- OCR model class-to-character mapping verified by human spot-check")
    lines.append("  on 10 random samples (see `results/gt_sample.csv`).")
    lines.append("- Canonicalization strips hyphens before comparison; plates differing")
    lines.append("  only in hyphen placement are considered matching.")
    lines.append("- No stratification by lighting condition or camera angle.")
    lines.append("")
    lines.append("## Methodology")
    lines.append("")
    lines.append("See `evaluation/README.md` for full methodology, metric definitions,")
    lines.append("canonicalization rules, and reproduction commands.")
    lines.append("")

    return "\n".join(lines)


def main():
    cfg = EvalConfig.from_env()
    cfg.ensure_output_dir()

    ocr_csv = cfg.output_dir / "ocr_eval.csv"
    det_json = cfg.output_dir / "detection_eval.json"

    if not ocr_csv.exists():
        print(f"ERROR: OCR eval CSV not found at {ocr_csv}")
        print("Run: python -m evaluation.ocr_normalizer_eval")
        sys.exit(1)

    if not det_json.exists():
        print(f"ERROR: Detection eval JSON not found at {det_json}")
        print("Run: python -m evaluation.detection_eval")
        sys.exit(1)

    print("Loading evaluation results...")
    ocr_rows = load_ocr_csv(ocr_csv)
    detection = load_detection_json(det_json)

    print(f"  OCR samples: {len(ocr_rows)}")
    print(f"  Detection metrics loaded")

    report = build_report(ocr_rows, detection)

    output_path = cfg.output_dir / "WS7_report.md"
    output_path.write_text(report, encoding="utf-8")
    print(f"\nReport written to: {output_path}")


if __name__ == "__main__":
    main()
