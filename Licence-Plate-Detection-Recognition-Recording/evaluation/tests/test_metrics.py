"""Unit tests for metrics module — TDD: tests written first."""

import pytest

from evaluation.metrics import (
    edit_distance,
    cer,
    exact_match,
    canonicalize,
    aggregate,
)


class TestEditDistance:
    """Levenshtein edit distance."""

    def test_identical_strings(self):
        assert edit_distance("ABC", "ABC") == 0

    def test_single_substitution(self):
        assert edit_distance("ABC", "ABD") == 1

    def test_single_insertion(self):
        assert edit_distance("AB", "ABC") == 1

    def test_single_deletion(self):
        assert edit_distance("ABC", "AB") == 1

    def test_empty_vs_nonempty(self):
        assert edit_distance("", "ABC") == 3
        assert edit_distance("ABC", "") == 3

    def test_both_empty(self):
        assert edit_distance("", "") == 0

    def test_completely_different(self):
        assert edit_distance("ABC", "XYZ") == 3

    def test_real_plate_example(self):
        # OCR read "9082" but GT is "90B2" -> 1 substitution
        assert edit_distance("9082", "90B2") == 1

    def test_mixed_operations(self):
        # "kitten" -> "sitting": 3 edits
        assert edit_distance("KITTEN", "SITTING") == 3


class TestCER:
    """Character Error Rate = edit_distance / len(gt)."""

    def test_perfect_match(self):
        assert cer("51G39466", "51G39466") == 0.0

    def test_single_error_over_length(self):
        # 1 substitution, gt length 8
        assert cer("51G39466", "51G39466") == 0.0
        assert cer("51G39466", "51G39467") == pytest.approx(1 / 8)

    def test_empty_gt_returns_zero(self):
        # Edge case: empty GT → CER=0 (avoid div by zero)
        assert cer("ABC", "") == 0.0

    def test_empty_pred_full_gt(self):
        # All chars are deletions
        assert cer("", "ABCD") == pytest.approx(4 / 4)

    def test_real_normalizer_recovery(self):
        # OCR: "9082-45230", GT: "90B2-45230" (after canonicalize, no hyphen)
        # 1 edit over 9 chars
        assert cer("908245230", "90B245230") == pytest.approx(1 / 9)


class TestExactMatch:
    """Exact match on canonicalized cores."""

    def test_identical(self):
        assert exact_match("51G-39466", "51G-39466") is True

    def test_hyphen_difference_still_matches(self):
        assert exact_match("51G-39466", "51G39466") is True

    def test_case_difference_still_matches(self):
        assert exact_match("51g-39466", "51G-39466") is True

    def test_different_content(self):
        assert exact_match("51G39466", "51G39467") is False

    def test_empty_both(self):
        assert exact_match("", "") is True

    def test_empty_vs_nonempty(self):
        assert exact_match("", "ABC") is False


class TestCanonicalize:
    """Strip non-alphanumeric, uppercase."""

    def test_removes_hyphens(self):
        assert canonicalize("51G-394-66") == "51G39466"

    def test_removes_dots_and_spaces(self):
        assert canonicalize("90-B2 452.30") == "90B245230"

    def test_uppercases(self):
        assert canonicalize("51g39466") == "51G39466"

    def test_empty(self):
        assert canonicalize("") == ""

    def test_already_clean(self):
        assert canonicalize("51G39466") == "51G39466"

    def test_special_chars_stripped(self):
        assert canonicalize("AB@C#1!2") == "ABC12"


class TestAggregate:
    """Aggregate rows into summary stats."""

    def test_perfect_scores(self):
        rows = [
            {"raw_match": True, "norm_match": True, "raw_cer": 0.0, "norm_cer": 0.0},
            {"raw_match": True, "norm_match": True, "raw_cer": 0.0, "norm_cer": 0.0},
        ]
        result = aggregate(rows)
        assert result["n"] == 2
        assert result["raw_exact_match_rate"] == 1.0
        assert result["norm_exact_match_rate"] == 1.0
        assert result["raw_mean_cer"] == 0.0
        assert result["norm_mean_cer"] == 0.0

    def test_mixed_scores(self):
        rows = [
            {"raw_match": False, "norm_match": True, "raw_cer": 0.125, "norm_cer": 0.0},
            {"raw_match": True, "norm_match": True, "raw_cer": 0.0, "norm_cer": 0.0},
        ]
        result = aggregate(rows)
        assert result["n"] == 2
        assert result["raw_exact_match_rate"] == pytest.approx(0.5)
        assert result["norm_exact_match_rate"] == pytest.approx(1.0)
        assert result["raw_mean_cer"] == pytest.approx(0.0625)
        assert result["norm_mean_cer"] == 0.0

    def test_empty_rows(self):
        result = aggregate([])
        assert result["n"] == 0
        assert result["raw_exact_match_rate"] == 0.0
        assert result["norm_exact_match_rate"] == 0.0

    def test_counts_improved_regressed_unchanged(self):
        rows = [
            {"raw_match": False, "norm_match": True, "raw_cer": 0.1, "norm_cer": 0.0},   # improved
            {"raw_match": True, "norm_match": False, "raw_cer": 0.0, "norm_cer": 0.1},   # regressed
            {"raw_match": True, "norm_match": True, "raw_cer": 0.0, "norm_cer": 0.0},    # unchanged
            {"raw_match": False, "norm_match": False, "raw_cer": 0.2, "norm_cer": 0.2},  # unchanged (both wrong)
        ]
        result = aggregate(rows)
        assert result["improved"] == 1
        assert result["regressed"] == 1
        assert result["unchanged"] == 2
