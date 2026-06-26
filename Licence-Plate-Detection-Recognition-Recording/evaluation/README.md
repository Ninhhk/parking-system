# WS7 — YOLOv8 + Normalizer Evaluation

## Purpose

Unbiased evaluation of the YOLOv8 two-stage license plate pipeline and the
position-aware `PlateNormalizer` contribution. Produces defensible metrics for
the thesis (báo cáo).

## Results Summary

| Component | Key Metric | Value |
|-----------|-----------|-------|
| Detection (Stage 1) | mAP@0.5 | 0.993 |
| Detection (Stage 1) | Precision | 0.995 |
| Detection (Stage 1) | Recall | 0.986 |
| OCR (Stage 2) | Exact-match (raw) | 76.0% (583/767) |
| OCR + Normalizer | Exact-match (norm) | 71.6% (549/767) |
| Normalizer delta | Improved / Regressed | 1 / 35 |

**Key finding**: The normalizer regresses on this mixed dataset because it
applies VN civilian corrections to non-VN plates (iwt, ndata, PlateBaza subsets)
that happen to match the 7-9 character length check. On VN-only plates (xemay
prefix), the normalizer performs as designed. See Discussion section below.

## Methodology

### Test Set

- **Detection set**: `D:\test YOLO\LP_detection\LP_detection\` — 1652 val images
  with plate-level bounding boxes (single class: license_plate).
- **OCR set**: `D:\test YOLO\OCR\OCR\` — 767 val images (cropped plates) with
  per-character bounding boxes (30 classes: digits + letters).
- **Justification**: These are pre-defined validation splits from the YOLOv8
  training datasets. They were held out from weight updates during training
  (used only for validation monitoring / early-stopping). This is the standard
  ML definition of a "test set" in academic work.

### Comparison Design

Toggle `PlateNormalizer.sanitize` on/off on identical pipeline output.
No external baseline (EasyOCR, PaddleOCR) — focus is on proving the normalizer's
contribution.

### Canonicalization Rule

Before comparing prediction vs ground truth:
1. Strip all non-alphanumeric characters (hyphens, dots, spaces).
2. Uppercase both strings.
3. Compare the resulting alphanumeric cores.

This avoids penalizing cosmetic hyphen placement differences.

### Ground-Truth Reconstruction

GT plate strings are reconstructed from YOLO per-character label files using
the same sort-by-x / split-by-y-mean assembly logic as `read_plate_v8`. The
class→character mapping is extracted from `model.names` (30 classes):

```
0→'1', 1→'2', 2→'3', ..., 8→'9', 9→'A', 10→'B', 11→'C', 12→'D',
13→'E', 14→'F', 15→'G', 16→'H', 17→'K', 18→'L', 19→'M', 20→'N',
21→'P', 22→'S', 23→'T', 24→'U', 25→'V', 26→'X', 27→'Y', 28→'Z', 29→'0'
```

Verified by human spot-check on 10 random samples (`results/gt_sample.csv`).

### Metrics

| Metric | Definition |
|--------|-----------|
| Exact-match accuracy | `1 if canonicalize(pred) == canonicalize(gt) else 0` |
| Character Error Rate (CER) | `edit_distance(pred_core, gt_core) / len(gt_core)` |
| Detection mAP@0.5 | Standard YOLO `model.val()` mAP at IoU=0.5 |

### Dataset Composition

| Category | Count | Description |
|----------|------:|-------------|
| xemay | 362 | Vietnamese motorbike plates (2-line) |
| ndata | 135 | Mixed VN plates |
| iwt | 119 | Non-standard / foreign-format plates |
| CarLongPlate | 97 | Vietnamese car plates (1-line) |
| PlateBaza | 54 | Foreign / non-VN plates |

## Discussion: Normalizer Regression Analysis

The normalizer regresses overall because:

1. **Non-VN plates pass shape check**: Plates from `iwt`, `ndata`, `PlateBaza`
   subsets have 7-9 alphanumeric chars (matching `MIN_CORE_LEN`/`MAX_CORE_LEN`)
   but don't follow VN civilian structure (province + series + serial).

2. **Position-aware correction misapplies**: The normalizer assumes index 2 is
   a series letter. For non-VN plates like `3B04082`, it converts `B`→`8` at
   index 1 (treating it as a digit position) and `0`→`O` at index 2 (treating
   it as a series letter position), producing `38O4082`.

3. **Thesis interpretation**: This is a valid limitation of position-aware
   correction — it requires knowing the plate origin. In the deployed parking-lot
   system, all plates ARE Vietnamese civilian, so the normalizer is correctly
   scoped. The evaluation dataset is broader than the deployment context.

**Potential fix** (not implemented): Add a VN-plate confidence check before
applying corrections (e.g., verify province code is in the known VN province
list: 11-99). This would reject non-VN plates before correction.

## Reproduction Commands

All commands run from `Licence-Plate-Detection-Recognition-Recording/`:

```bash
# Prerequisites: models in repo5/model/, datasets at default paths
# (or override via EVAL_OCR_DATASET, EVAL_DET_DATASET env vars)

# 1. Verify GT reconstruction mapping (human eyeball check)
python -m evaluation.verify_gt --limit 10 --print-mapping

# 2. Run full OCR + normalizer evaluation (767 samples, ~80s)
python -m evaluation.ocr_normalizer_eval

# 3. Run detection evaluation (1652 images, ~20s with GPU)
python -m evaluation.detection_eval

# 4. Generate final report
python -m evaluation.generate_report

# Quick test (subset)
python -m evaluation.ocr_normalizer_eval --limit 20
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `EVAL_OCR_DATASET` | `D:\test YOLO\OCR\OCR` | OCR dataset root |
| `EVAL_DET_DATASET` | `D:\test YOLO\LP_detection\LP_detection` | Detection dataset root |
| `EVAL_OUTPUT_DIR` | `evaluation/results/` | Output directory |
| `EVAL_STAGE1_MODEL` | `repo5/model/license_plate_detector.pt` | Stage 1 model |
| `EVAL_STAGE2_MODEL` | `repo5/model/LP_ocr_yolov8.pt` | Stage 2 model |

### Running Tests

```bash
# All evaluation unit tests (no model loading)
python -m pytest evaluation/tests/ -v

# Specific test file
python -m pytest evaluation/tests/test_metrics.py -v
```

## Output Files

| File | Description |
|------|-------------|
| `results/ocr_eval.csv` | Per-sample OCR results (767 rows) |
| `results/detection_eval.json` | Detection mAP/P/R |
| `results/detection_data.yaml` | Generated YOLO data config |
| `results/gt_sample.csv` | GT reconstruction spot-check |
| `results/WS7_report.md` | Final evaluation report |

## Limitations

- Test set = pre-defined validation split (not used for weight updates,
  but seen during training monitoring for early-stopping).
- Dataset contains non-Vietnamese plates that don't match the normalizer's
  target domain (VN civilian plates only).
- OCR model class→char mapping verified by human spot-check on 10 samples.
- Canonicalization strips hyphens before comparison.
- No stratification by lighting condition or camera angle.
- No statistical significance test (McNemar's) — could be added if defense
  committee requests it.

## File Structure

```
evaluation/
├── __init__.py
├── eval_config.py          # Configuration (paths, env vars)
├── metrics.py              # Edit distance, CER, exact-match, aggregate
├── gt_reconstruction.py    # YOLO label → plate string reconstruction
├── verify_gt.py            # Human verification helper (loads model)
├── ocr_normalizer_eval.py  # Main OCR eval runner (loads model)
├── detection_eval.py       # Detection eval runner (loads model)
├── generate_report.py      # Report aggregator (no model)
├── README.md               # This file
├── results/                # Generated outputs (gitignored)
│   ├── ocr_eval.csv
│   ├── detection_eval.json
│   ├── detection_data.yaml
│   ├── gt_sample.csv
│   └── WS7_report.md
└── tests/
    ├── __init__.py
    ├── test_eval_config.py
    ├── test_metrics.py
    ├── test_gt_reconstruction.py
    ├── test_verify_gt.py
    ├── test_ocr_normalizer_eval.py
    ├── test_detection_eval.py
    └── test_generate_report.py
```
