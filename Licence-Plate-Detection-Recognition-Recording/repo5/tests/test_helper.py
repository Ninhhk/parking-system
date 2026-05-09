"""Unit tests for function/helper.py — Plate_Assembler."""
import sys
import os
from unittest.mock import MagicMock

import pytest

# Ensure repo5 root is on the path so `function.helper` is importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from function.helper import check_point_linear, read_plate


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_mock_model(bb_list):
    """Return a callable mock whose result chain satisfies helper.py's access pattern.

    helper.py does:
        results = yolo_license_plate(im)
        bb_list = results.pandas().xyxy[0].values.tolist()
        ...
        size = results.pandas().s          # attribute access — result unused
    """
    mock_result = MagicMock()
    mock_result.pandas.return_value.xyxy.__getitem__.return_value.values.tolist.return_value = bb_list
    model = MagicMock(return_value=mock_result)
    return model


def make_bb(xmin, ymin, xmax, ymax, char, conf=0.9, cls_id=0):
    """Build a bounding-box row in the format helper.py expects:
    [xmin, ymin, xmax, ymax, confidence, class_id_int, class_name_str]
    """
    return [xmin, ymin, xmax, ymax, conf, cls_id, char]


# ---------------------------------------------------------------------------
# check_point_linear
# ---------------------------------------------------------------------------

class TestCheckPointLinear:
    def test_collinear_point_returns_true(self):
        # Line through (2, 4) and (10, 20): slope=2, intercept=0 → y=2x
        # Point (5, 10) lies exactly on the line
        assert check_point_linear(5, 10, 2, 4, 10, 20) is True

    def test_non_collinear_point_returns_false(self):
        # Line through (2, 4) and (10, 20): y=2x
        # Point (5, 20) is far off (predicted y=10, actual y=20, diff=10 > tol=3)
        assert check_point_linear(5, 20, 2, 4, 10, 20) is False

    def test_within_abs_tol_3_returns_true(self):
        # Line through (2, 4) and (10, 20): y=2x, predicted at x=5 is y=10
        # Point (5, 12) — diff=2, within abs_tol=3
        assert check_point_linear(5, 12, 2, 4, 10, 20) is True

    def test_just_outside_abs_tol_3_returns_false(self):
        # Line through (2, 4) and (10, 20): y=2x, predicted at x=5 is y=10
        # Point (5, 14) — diff=4, outside abs_tol=3
        assert check_point_linear(5, 14, 2, 4, 10, 20) is False


# ---------------------------------------------------------------------------
# read_plate — character count boundary tests
# ---------------------------------------------------------------------------

class TestReadPlateCharacterCount:
    def test_exactly_6_chars_returns_unknown(self):
        bb_list = [make_bb(i * 10, 0, i * 10 + 8, 20, str(i)) for i in range(6)]
        model = make_mock_model(bb_list)
        assert read_plate(model, None) == "unknown"

    def test_exactly_7_chars_returns_assembled_string(self):
        # 7 collinear characters on a horizontal line → 1-line plate
        bb_list = [make_bb(i * 10, 0, i * 10 + 8, 20, str(i)) for i in range(7)]
        model = make_mock_model(bb_list)
        result = read_plate(model, None)
        assert result != "unknown"
        assert len(result) == 7

    def test_exactly_10_chars_returns_assembled_string(self):
        # 10 collinear characters → 1-line plate
        bb_list = [make_bb(i * 10, 0, i * 10 + 8, 20, str(i % 10)) for i in range(10)]
        model = make_mock_model(bb_list)
        result = read_plate(model, None)
        assert result != "unknown"
        assert len(result) == 10

    def test_exactly_11_chars_returns_unknown(self):
        bb_list = [make_bb(i * 10, 0, i * 10 + 8, 20, str(i % 10)) for i in range(11)]
        model = make_mock_model(bb_list)
        assert read_plate(model, None) == "unknown"


# ---------------------------------------------------------------------------
# read_plate — 1-line assembly (all centers collinear)
# ---------------------------------------------------------------------------

class TestReadPlate1Line:
    def test_1line_characters_sorted_by_x(self):
        # All bbs on y=10 (horizontal line) — collinear by definition.
        # Provide them in reverse X order to confirm sorting.
        chars = ["A", "B", "C", "D", "E", "F", "G"]
        # Reverse order: x = 60, 50, 40, 30, 20, 10, 0
        bb_list = [
            make_bb(x, 5, x + 8, 15, c)
            for c, x in zip(chars, [60, 50, 40, 30, 20, 10, 0])
        ]
        model = make_mock_model(bb_list)
        result = read_plate(model, None)
        # Expected: sorted by ascending X → G F E D C B A
        assert result == "GFEDCBA"
        assert "-" not in result

    def test_1line_no_separator(self):
        chars = ["5", "9", "L", "1", "2", "3", "4"]
        bb_list = [make_bb(i * 10, 5, i * 10 + 8, 15, c) for i, c in enumerate(chars)]
        model = make_mock_model(bb_list)
        result = read_plate(model, None)
        assert "-" not in result


# ---------------------------------------------------------------------------
# read_plate — 2-line assembly (non-collinear centers)
# ---------------------------------------------------------------------------

class TestReadPlate2Line:
    def test_2line_characters_split_by_y_mean_and_sorted_by_x(self):
        # Line 1 (top, y≈10): chars "5", "9", "L" at x=0,10,20
        # Line 2 (bottom, y≈50): chars "1", "2", "3", "4" at x=0,10,20,30
        # y_mean ≈ (10*3 + 50*4) / 7 ≈ 32 → line1 y<32, line2 y>32
        line1 = [make_bb(i * 10, 5, i * 10 + 8, 15, c) for i, c in enumerate(["5", "9", "L"])]
        line2 = [make_bb(i * 10, 45, i * 10 + 8, 55, c) for i, c in enumerate(["1", "2", "3", "4"])]
        bb_list = line1 + line2
        model = make_mock_model(bb_list)
        result = read_plate(model, None)
        assert "-" in result
        parts = result.split("-")
        assert len(parts) == 2
        assert parts[0] == "59L"
        assert parts[1] == "1234"

    def test_2line_each_line_sorted_by_x(self):
        # Provide line2 chars in reverse X order to confirm per-line sorting
        line1 = [make_bb(i * 10, 5, i * 10 + 8, 15, c) for i, c in enumerate(["A", "B", "C"])]
        # Reverse X for line2: x=30,20,10,0 → chars D,E,F,G
        line2 = [
            make_bb(x, 45, x + 8, 55, c)
            for c, x in zip(["D", "E", "F", "G"], [30, 20, 10, 0])
        ]
        bb_list = line1 + line2
        model = make_mock_model(bb_list)
        result = read_plate(model, None)
        parts = result.split("-")
        assert parts[0] == "ABC"
        assert parts[1] == "GFED"
