"""Unit tests for report generator logic."""

import pytest

from evaluation.generate_report import (
    build_report,
    classify_dataset_composition,
    find_recovery_examples,
    find_regression_examples,
)


SAMPLE_ROWS = [
    {
        "filename": "1xemay1043",
        "gt_plate": "84L1-31408",
        "gt_core": "84L131408",
        "raw_text": "84L1-31408",
        "raw_core": "84L131408",
        "norm_text": "84L1-31408",
        "norm_core": "84L131408",
        "raw_match": True,
        "norm_match": True,
        "raw_cer": 0.0,
        "norm_cer": 0.0,
    },
    {
        "filename": "2xemay1203",
        "gt_plate": "59T1-92270",
        "gt_core": "59T192270",
        "raw_text": "59T1-92270",
        "raw_core": "59T192270",
        "norm_text": "59T1-92270",
        "norm_core": "59T192270",
        "raw_match": True,
        "norm_match": True,
        "raw_cer": 0.0,
        "norm_cer": 0.0,
    },
    {
        "filename": "3xemay744",
        "gt_plate": "50G-39466",
        "gt_core": "50G39466",
        "raw_text": "5OG-39466",
        "raw_core": "5OG39466",
        "norm_text": "50G-39466",
        "norm_core": "50G39466",
        "raw_match": False,
        "norm_match": True,
        "raw_cer": 0.125,
        "norm_cer": 0.0,
    },
    {
        "filename": "3CarLongPlate248",
        "gt_plate": "30A12345",
        "gt_core": "30A12345",
        "raw_text": "30A12345",
        "raw_core": "30A12345",
        "norm_text": "30A12345",
        "norm_core": "30A12345",
        "raw_match": True,
        "norm_match": True,
        "raw_cer": 0.0,
        "norm_cer": 0.0,
    },
]


class TestFindRecoveryExamples:
    """Test recovery example extraction."""

    def test_finds_recoveries(self):
        examples = find_recovery_examples(SAMPLE_ROWS)
        assert len(examples) == 1
        assert examples[0]["filename"] == "3xemay744"

    def test_max_limit(self):
        # Duplicate the recovery row
        rows = SAMPLE_ROWS * 10
        examples = find_recovery_examples(rows, max_examples=3)
        assert len(examples) == 3

    def test_empty_when_no_recoveries(self):
        rows = [r for r in SAMPLE_ROWS if r["raw_match"]]
        assert find_recovery_examples(rows) == []


class TestFindRegressionExamples:
    """Test regression example extraction."""

    def test_empty_when_no_regressions(self):
        assert find_regression_examples(SAMPLE_ROWS) == []

    def test_finds_regressions(self):
        rows = SAMPLE_ROWS + [{
            "filename": "regressed1",
            "gt_plate": "90B2-45230",
            "gt_core": "90B245230",
            "raw_text": "90B2-45230",
            "raw_core": "90B245230",
            "norm_text": "9082-45230",
            "norm_core": "908245230",
            "raw_match": True,
            "norm_match": False,
            "raw_cer": 0.0,
            "norm_cer": 0.111,
        }]
        examples = find_regression_examples(rows)
        assert len(examples) == 1
        assert examples[0]["filename"] == "regressed1"


class TestClassifyDatasetComposition:
    """Test filename-based classification."""

    def test_classifies_by_prefix(self):
        result = classify_dataset_composition(SAMPLE_ROWS)
        cats = result["categories"]
        assert cats["xemay"] == 3  # 1xemay1043, 2xemay1203, 3xemay744
        assert cats["CarLongPlate"] == 1

    def test_counts_line_types(self):
        result = classify_dataset_composition(SAMPLE_ROWS)
        # 3 have hyphens in gt_plate (2-line), 1 doesn't
        assert result["two_line"] == 3
        assert result["one_line"] == 1


class TestBuildReport:
    """Test full report generation."""

    def test_contains_section_headers(self):
        detection = {"mAP50": 0.993, "mAP50_95": 0.607, "precision": 0.995, "recall": 0.986}
        report = build_report(SAMPLE_ROWS, detection)
        assert "## Section A" in report
        assert "## Section B" in report
        assert "## Limitations" in report

    def test_contains_metrics_table(self):
        detection = {"mAP50": 0.993, "mAP50_95": 0.607, "precision": 0.995, "recall": 0.986}
        report = build_report(SAMPLE_ROWS, detection)
        assert "Exact-match accuracy" in report
        assert "Mean CER" in report
        assert "0.9930" in report  # mAP

    def test_contains_recovery_examples(self):
        detection = {"mAP50": 0.99, "mAP50_95": 0.6, "precision": 0.99, "recall": 0.98}
        report = build_report(SAMPLE_ROWS, detection)
        assert "3xemay744" in report
        assert "Recovery Examples" in report

    def test_no_regression_section_when_none(self):
        detection = {"mAP50": 0.99, "mAP50_95": 0.6, "precision": 0.99, "recall": 0.98}
        report = build_report(SAMPLE_ROWS, detection)
        assert "Regression Examples" not in report

    def test_returns_string(self):
        detection = {"mAP50": 0.99, "mAP50_95": 0.6, "precision": 0.99, "recall": 0.98}
        report = build_report(SAMPLE_ROWS, detection)
        assert isinstance(report, str)
        assert len(report) > 100
