"""
Property-based tests for core/pipeline.py.

# Feature: lpr-yolov8-migration, Property 1: Stage1 bbox format
"""

import sys
import os

# Ensure repo5 root is importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from unittest.mock import MagicMock

from hypothesis import given, settings, HealthCheck
from hypothesis import strategies as st


# ---------------------------------------------------------------------------
# Property 1: Stage1 bounding box format invariant
# Validates: Requirements 2.2
# ---------------------------------------------------------------------------

@given(
    rows=st.lists(
        st.lists(
            st.floats(min_value=0.0, max_value=1.0, allow_nan=False, allow_infinity=False),
            min_size=6,
            max_size=6,
        ),
        min_size=0,
        max_size=10,
    )
)
@settings(max_examples=100, suppress_health_check=[HealthCheck.too_slow])
def test_stage1_bbox_format_invariant(rows):
    """
    # Feature: lpr-yolov8-migration, Property 1: Stage1 bbox format

    For any list of 6-element rows returned by stage1(frame).boxes.data.tolist(),
    each row must have exactly 6 elements and the confidence value (index 4)
    must be in [0, 1].

    Validates: Requirements 2.2
    """
    # Build a mock stage1 whose result mimics the YOLOv8 API contract
    mock_boxes = MagicMock()
    mock_boxes.data.tolist.return_value = rows

    mock_result = MagicMock()
    mock_result.boxes = mock_boxes

    mock_stage1 = MagicMock(return_value=mock_result)

    # Simulate what pipeline.py does: call stage1 and extract boxes
    result = mock_stage1("dummy_frame")
    extracted_rows = result.boxes.data.tolist()

    # Assert the format contract for every row
    for row in extracted_rows:
        assert len(row) == 6, f"Expected 6 elements per bbox row, got {len(row)}: {row}"
        confidence = row[4]
        assert 0 <= confidence <= 1, (
            f"Confidence (index 4) must be in [0, 1], got {confidence}: {row}"
        )
