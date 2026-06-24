"""Unit tests for OCR normalizer eval (row-building logic, no model)."""

import pytest
from pathlib import Path

from evaluation.ocr_normalizer_eval import build_eval_row, get_paired_files


class TestBuildEvalRow:
    """Test per-sample row building."""

    def test_perfect_match_no_normalization_effect(self):
        """Raw already correct → norm also correct."""
        row = build_eval_row(
            "test_img",
            "51G-39466",
            "51G-39466",
            normalizer_fn=lambda x: x,  # identity
        )
        assert row["filename"] == "test_img"
        assert row["raw_match"] is True
        assert row["norm_match"] is True
        assert row["raw_cer"] == 0.0
        assert row["norm_cer"] == 0.0

    def test_normalizer_fixes_ocr_error(self):
        """OCR reads 'O' instead of '0', normalizer fixes it."""
        def fake_normalizer(raw):
            return raw.replace("O", "0")

        row = build_eval_row(
            "plate1",
            "5OG-39466",   # OCR confused O for 0
            "50G-39466",   # GT
            normalizer_fn=fake_normalizer,
        )
        assert row["raw_match"] is False
        assert row["norm_match"] is True
        assert row["raw_cer"] > 0
        assert row["norm_cer"] == 0.0

    def test_normalizer_regression(self):
        """Normalizer changes a correct char to wrong one (edge case)."""
        def bad_normalizer(raw):
            return raw.replace("B", "8")  # wrongly converts series letter

        row = build_eval_row(
            "plate2",
            "90B2-45230",  # Raw is correct
            "90B2-45230",  # GT
            normalizer_fn=bad_normalizer,
        )
        assert row["raw_match"] is True
        assert row["norm_match"] is False
        assert row["raw_cer"] == 0.0
        assert row["norm_cer"] > 0

    def test_empty_raw_text(self):
        """OCR returned 'unknown' → empty raw, should compute CER vs GT."""
        row = build_eval_row(
            "failed",
            "",
            "51G-39466",
            normalizer_fn=lambda x: x,
        )
        assert row["raw_match"] is False
        assert row["raw_core"] == ""
        assert row["gt_core"] == "51G39466"
        # CER = 8 edits / 8 chars = 1.0
        assert row["raw_cer"] == 1.0

    def test_canonicalization_applied(self):
        """Hyphens stripped before comparison."""
        row = build_eval_row(
            "plate3",
            "90B245230",      # no hyphen
            "90B2-45230",     # with hyphen
            normalizer_fn=lambda x: x,
        )
        # Cores are both "90B245230" → match
        assert row["raw_match"] is True

    def test_row_has_all_fields(self):
        """Check all expected fields are present."""
        row = build_eval_row("x", "ABC", "ABC", normalizer_fn=lambda x: x)
        expected_keys = {
            "filename", "gt_plate", "gt_core", "raw_text", "raw_core",
            "norm_text", "norm_core", "raw_match", "norm_match",
            "raw_cer", "norm_cer",
        }
        assert set(row.keys()) == expected_keys


class TestGetPairedFiles:
    """Test image-label pairing logic."""

    def test_pairs_matched_by_stem(self, tmp_path):
        """Finds pairs where image and label share stem name."""
        img_dir = tmp_path / "images"
        lbl_dir = tmp_path / "labels"
        img_dir.mkdir()
        lbl_dir.mkdir()

        (img_dir / "plate1.jpg").write_text("fake")
        (img_dir / "plate2.jpg").write_text("fake")
        (lbl_dir / "plate1.txt").write_text("0 0.5 0.5 0.1 0.2")
        (lbl_dir / "plate2.txt").write_text("1 0.5 0.5 0.1 0.2")

        pairs = get_paired_files(img_dir, lbl_dir)
        assert len(pairs) == 2
        assert pairs[0][0].stem == "plate1"
        assert pairs[0][1].stem == "plate1"

    def test_unmatched_files_skipped(self, tmp_path):
        """Images without labels are skipped."""
        img_dir = tmp_path / "images"
        lbl_dir = tmp_path / "labels"
        img_dir.mkdir()
        lbl_dir.mkdir()

        (img_dir / "plate1.jpg").write_text("fake")
        (img_dir / "orphan.jpg").write_text("fake")
        (lbl_dir / "plate1.txt").write_text("0 0.5 0.5 0.1 0.2")

        pairs = get_paired_files(img_dir, lbl_dir)
        assert len(pairs) == 1
        assert pairs[0][0].stem == "plate1"

    def test_empty_dirs(self, tmp_path):
        """Empty directories return empty list."""
        img_dir = tmp_path / "images"
        lbl_dir = tmp_path / "labels"
        img_dir.mkdir()
        lbl_dir.mkdir()
        assert get_paired_files(img_dir, lbl_dir) == []
