"""Unit tests for verify_gt helper (no model loading)."""

import pytest
from pathlib import Path

from evaluation.verify_gt import format_sample_rows, get_label_files


MOCK_NAMES = {0: "0", 1: "1", 2: "2", 3: "3", 4: "4", 5: "5"}


class TestFormatSampleRows:
    """Test sample row formatting with mocked label files."""

    def test_limit_respected(self, tmp_path):
        """Sampling respects the limit parameter."""
        # Create 5 label files
        for i in range(5):
            lf = tmp_path / f"plate{i}.txt"
            lf.write_text(f"{i} 0.{i+1} 0.5 0.1 0.2\n")

        label_files = sorted(tmp_path.glob("*.txt"))
        rows = format_sample_rows(label_files, MOCK_NAMES, limit=3)
        assert len(rows) == 3

    def test_all_returned_when_limit_exceeds_count(self, tmp_path):
        """Returns all files when limit > available files."""
        for i in range(2):
            lf = tmp_path / f"plate{i}.txt"
            lf.write_text(f"{i} 0.5 0.5 0.1 0.2\n")

        label_files = sorted(tmp_path.glob("*.txt"))
        rows = format_sample_rows(label_files, MOCK_NAMES, limit=10)
        assert len(rows) == 2

    def test_row_structure(self, tmp_path):
        """Each row has filename, reconstructed_plate, num_chars."""
        lf = tmp_path / "test_plate.txt"
        lf.write_text("5 0.2 0.5 0.1 0.2\n1 0.5 0.5 0.1 0.2\n3 0.8 0.5 0.1 0.2\n")

        label_files = [lf]
        rows = format_sample_rows(label_files, MOCK_NAMES, limit=1)
        assert rows[0]["filename"] == "test_plate"
        assert rows[0]["reconstructed_plate"] == "513"
        assert rows[0]["num_chars"] == 3

    def test_two_line_plate_num_chars_excludes_hyphen(self, tmp_path):
        """num_chars counts only alphanumeric chars (no hyphen)."""
        lf = tmp_path / "two_line.txt"
        # 4 chars top (y=0.3), 4 chars bottom (y=0.7) → 2-line
        lf.write_text(
            "1 0.2 0.3 0.1 0.2\n2 0.5 0.3 0.1 0.2\n"
            "3 0.2 0.7 0.1 0.2\n4 0.5 0.7 0.1 0.2\n"
        )
        label_files = [lf]
        rows = format_sample_rows(label_files, MOCK_NAMES, limit=1)
        # "12-34" → 4 chars
        assert rows[0]["num_chars"] == 4
        assert "-" in rows[0]["reconstructed_plate"]


class TestGetLabelFiles:
    """Test label file listing."""

    def test_finds_txt_files(self, tmp_path):
        (tmp_path / "a.txt").write_text("0 0.5 0.5 0.1 0.2")
        (tmp_path / "b.txt").write_text("1 0.5 0.5 0.1 0.2")
        (tmp_path / "c.jpg").write_text("not a label")
        files = get_label_files(tmp_path)
        assert len(files) == 2

    def test_nonexistent_dir(self, tmp_path):
        files = get_label_files(tmp_path / "nope")
        assert files == []
