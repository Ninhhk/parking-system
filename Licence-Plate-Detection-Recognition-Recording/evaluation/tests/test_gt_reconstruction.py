"""Unit tests for GT reconstruction from YOLO character labels."""

import pytest

from evaluation.gt_reconstruction import (
    parse_yolo_label,
    assemble_plate_string,
    reconstruct_plate,
)


# Sample class→char mapping (subset matching typical OCR model)
# Based on common YOLOv8 LP OCR class ordering:
# classes 0-9 map to digits/letters, class 29 maps to '0', etc.
# For tests we use a simple 0-based mapping.
SAMPLE_NAMES = {
    0: "0", 1: "1", 2: "2", 3: "3", 4: "4",
    5: "5", 6: "6", 7: "7", 8: "8", 9: "9",
    10: "A", 11: "B", 12: "C", 13: "D", 14: "E",
    15: "F", 16: "G", 17: "H", 18: "K", 19: "L",
    20: "M", 21: "N", 22: "P", 23: "R", 24: "S",
    25: "T", 26: "U", 27: "V", 28: "X", 29: "Y",
}


class TestParseYoloLabel:
    """Parse YOLO-format label lines into structured boxes."""

    def test_single_line(self):
        content = "5 0.5 0.5 0.1 0.2\n"
        boxes = parse_yolo_label(content)
        assert len(boxes) == 1
        assert boxes[0]["class_id"] == 5
        assert boxes[0]["x_center"] == pytest.approx(0.5)
        assert boxes[0]["y_center"] == pytest.approx(0.5)

    def test_multiple_lines(self):
        content = "0 0.1 0.5 0.05 0.3\n3 0.3 0.5 0.05 0.3\n7 0.5 0.5 0.05 0.3\n"
        boxes = parse_yolo_label(content)
        assert len(boxes) == 3
        assert [b["class_id"] for b in boxes] == [0, 3, 7]

    def test_empty_content(self):
        assert parse_yolo_label("") == []
        assert parse_yolo_label("\n\n") == []

    def test_whitespace_tolerance(self):
        content = "  2  0.25  0.5  0.1  0.2  \n"
        boxes = parse_yolo_label(content)
        assert len(boxes) == 1
        assert boxes[0]["class_id"] == 2

    def test_real_label_format(self):
        """From actual OCR label file: 8 chars."""
        content = (
            "8 0.255921 0.716964 0.114474 0.316071\n"
            "4 0.584211 0.708929 0.094737 0.310714\n"
            "29 0.414474 0.714286 0.107895 0.300000\n"
            "2 0.733553 0.308929 0.098684 0.317857\n"
            "4 0.733553 0.695536 0.130263 0.326786\n"
            "4 0.251316 0.321429 0.123684 0.317857\n"
            "3 0.383553 0.319643 0.109211 0.325000\n"
            "24 0.615132 0.303571 0.127632 0.332143\n"
        )
        boxes = parse_yolo_label(content)
        assert len(boxes) == 8


class TestAssemblePlateString:
    """Assemble plate string from sorted character boxes."""

    def test_single_line_sorted_by_x(self):
        """All chars on one line → sorted left-to-right."""
        boxes = [
            {"class_id": 5, "x_center": 0.1, "y_center": 0.5},
            {"class_id": 1, "x_center": 0.3, "y_center": 0.5},
            {"class_id": 16, "x_center": 0.5, "y_center": 0.5},  # G
            {"class_id": 3, "x_center": 0.7, "y_center": 0.5},
            {"class_id": 9, "x_center": 0.9, "y_center": 0.5},
        ]
        result = assemble_plate_string(boxes, SAMPLE_NAMES)
        assert result == "51G39"

    def test_two_line_plate(self):
        """2-line plate: top chars first, then hyphen, then bottom chars."""
        boxes = [
            # Top line (y ~ 0.3)
            {"class_id": 9, "x_center": 0.2, "y_center": 0.3},  # Y->9
            {"class_id": 0, "x_center": 0.4, "y_center": 0.3},
            {"class_id": 11, "x_center": 0.6, "y_center": 0.3},  # B
            {"class_id": 2, "x_center": 0.8, "y_center": 0.3},
            # Bottom line (y ~ 0.7)
            {"class_id": 4, "x_center": 0.1, "y_center": 0.7},
            {"class_id": 5, "x_center": 0.3, "y_center": 0.7},
            {"class_id": 2, "x_center": 0.5, "y_center": 0.7},
            {"class_id": 3, "x_center": 0.7, "y_center": 0.7},
            {"class_id": 0, "x_center": 0.9, "y_center": 0.7},
        ]
        result = assemble_plate_string(boxes, SAMPLE_NAMES)
        # Top: 90B2, Bottom: 45230 → "90B2-45230"
        assert result == "90B2-45230"

    def test_empty_boxes(self):
        assert assemble_plate_string([], SAMPLE_NAMES) == ""

    def test_single_char(self):
        boxes = [{"class_id": 10, "x_center": 0.5, "y_center": 0.5}]
        result = assemble_plate_string(boxes, SAMPLE_NAMES)
        assert result == "A"

    def test_borderline_same_y_treated_as_single_line(self):
        """Chars at similar y (within tolerance) → single-line."""
        boxes = [
            {"class_id": 5, "x_center": 0.2, "y_center": 0.49},
            {"class_id": 1, "x_center": 0.5, "y_center": 0.51},
            {"class_id": 16, "x_center": 0.8, "y_center": 0.50},
        ]
        result = assemble_plate_string(boxes, SAMPLE_NAMES)
        assert result == "51G"  # single line, sorted by x


class TestReconstructPlate:
    """End-to-end: label content + names → plate string."""

    def test_single_line_plate(self):
        # 5 chars all at y=0.5
        content = (
            "5 0.1 0.5 0.05 0.3\n"
            "1 0.3 0.5 0.05 0.3\n"
            "16 0.5 0.5 0.05 0.3\n"
            "3 0.7 0.5 0.05 0.3\n"
            "9 0.9 0.5 0.05 0.3\n"
        )
        result = reconstruct_plate(content, SAMPLE_NAMES)
        assert result == "51G39"

    def test_two_line_plate_from_real_format(self):
        """Simulates real 2-line OCR label (top row + bottom row)."""
        content = (
            "4 0.251316 0.321429 0.123684 0.317857\n"  # top
            "3 0.383553 0.319643 0.109211 0.325000\n"  # top
            "24 0.615132 0.303571 0.127632 0.332143\n"  # top (S)
            "2 0.733553 0.308929 0.098684 0.317857\n"  # top
            "8 0.255921 0.716964 0.114474 0.316071\n"  # bottom
            "29 0.414474 0.714286 0.107895 0.300000\n"  # bottom (Y)
            "4 0.584211 0.708929 0.094737 0.310714\n"  # bottom
            "4 0.733553 0.695536 0.130263 0.326786\n"  # bottom
        )
        result = reconstruct_plate(content, SAMPLE_NAMES)
        # Top sorted by x: 4(0.25) 3(0.38) S(0.61) 2(0.73) → "43S2"
        # Bottom sorted by x: 8(0.25) Y(0.41) 4(0.58) 4(0.73) → "8Y44"
        assert result == "43S2-8Y44"

    def test_empty_label(self):
        assert reconstruct_plate("", SAMPLE_NAMES) == ""
