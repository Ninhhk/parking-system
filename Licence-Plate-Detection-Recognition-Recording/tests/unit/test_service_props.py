"""Property-based tests for Repo5LPDService and PlateNormalizer.

Uses hypothesis with @given and @settings(max_examples=100).
All service tests inject mock stage1/stage2 — no .pt files loaded.
"""

from __future__ import annotations

import base64
import io
import re
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import cv2
import numpy as np
import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from services.plate_normalizer import PlateNormalizer
from services.repo5_lpd_service import Repo5LPDConfig, Repo5LPDService


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_valid_b64() -> str:
    """Encode a tiny black PNG as base64."""
    img = np.zeros((10, 10, 3), dtype=np.uint8)
    _, buf = cv2.imencode(".png", img)
    return base64.b64encode(buf.tobytes()).decode()


def _make_service(pipeline_return=None) -> Repo5LPDService:
    """Build a Repo5LPDService with mocked internals."""
    mock_stage1 = MagicMock()
    mock_stage2 = MagicMock()
    mock_pipeline = pipeline_return if pipeline_return is not None else []

    with patch("services.repo5_lpd_service._repo5_import_path"):
        with patch.dict(
            "sys.modules",
            {
                "core": MagicMock(),
                "core.models": MagicMock(),
                "core.pipeline": MagicMock(),
            },
        ):
            svc = Repo5LPDService(stage1=mock_stage1, stage2=mock_stage2)

    svc._run_pipeline = MagicMock(return_value=mock_pipeline)
    return svc


def _valid_frame() -> np.ndarray:
    return np.zeros((48, 96, 3), dtype=np.uint8)


# ---------------------------------------------------------------------------
# Strategies
# ---------------------------------------------------------------------------

plate_dict_strategy = st.fixed_dictionaries(
    {
        "text": st.text(min_size=0, max_size=20),
        "bbox": st.lists(
            st.floats(min_value=0, max_value=1000, allow_nan=False, allow_infinity=False),
            min_size=4,
            max_size=4,
        ),
        "confidence": st.floats(
            min_value=0.0, max_value=1.0, allow_nan=False, allow_infinity=False
        ),
    }
)

plates_strategy = st.lists(plate_dict_strategy, min_size=0, max_size=10)

b64_strategy = st.one_of(
    st.just(_make_valid_b64()),
    st.text(min_size=1, max_size=20),
)

images_strategy = st.lists(b64_strategy, min_size=1, max_size=10)


# ---------------------------------------------------------------------------
# FakeLPDService for HTTP property tests
# ---------------------------------------------------------------------------


class _FakeLPDService:
    """Minimal stub that returns a fixed plates list from detect_frame()."""

    def __init__(self, plates):
        self.config = Repo5LPDConfig(
            stage1_model_path=Path("repo5/model/license_plate_detector.pt"),
            stage2_model_path=Path("repo5/model/LP_ocr_yolov8.pt"),
        )
        self._plates = plates

    def is_ready(self):
        return True

    def ensure_ready(self):
        pass

    def detect_frame(self, frame):
        return {
            "plates": self._plates,
            "plate_count": len(self._plates),
            "inference_time_ms": 1.0,
        }

    def detect_best_plate(self, frame):
        ...

    def detect_base64_batch(self, images):
        ...


# ---------------------------------------------------------------------------
# Property 2: detect_frame() structural invariant
# ---------------------------------------------------------------------------


@pytest.mark.property
@given(plates=plates_strategy)
@settings(max_examples=100)
def test_detect_frame_structural_invariant(plates):
    # Feature: lpd-pipeline-replacement, Property 2
    # For any list of plate dicts, detect_frame() returns a dict with exactly
    # the keys plates, plate_count, inference_time_ms.
    # Validates: Requirements 5.1, 5.2
    svc = _make_service(pipeline_return=plates)
    result = svc.detect_frame(_valid_frame())
    assert set(result.keys()) == {"plates", "plate_count", "inference_time_ms"}


# ---------------------------------------------------------------------------
# Property 2 (count sub-invariant): plate_count == len(plates)
# ---------------------------------------------------------------------------


@pytest.mark.property
@given(plates=plates_strategy)
@settings(max_examples=100)
def test_plate_count_equals_len_plates(plates):
    # Feature: lpd-pipeline-replacement, Property 2
    # plate_count always equals len(plates) in the detect_frame() return value.
    # Validates: Requirements 5.2
    svc = _make_service(pipeline_return=plates)
    result = svc.detect_frame(_valid_frame())
    assert result["plate_count"] == len(result["plates"])


# ---------------------------------------------------------------------------
# Property 3: detect_best_plate() success condition
# ---------------------------------------------------------------------------


@pytest.mark.property
@given(plates=plates_strategy)
@settings(max_examples=100)
def test_detect_best_plate_success_condition(plates):
    # Feature: lpd-pipeline-replacement, Property 3
    # success: True iff the best (max-confidence) plate has non-empty normalized text.
    # Validates: Requirements 5.5
    svc = _make_service(pipeline_return=plates)
    result = svc.detect_best_plate(_valid_frame())

    if not plates:
        # No plates at all → always failure
        assert result["success"] is False
        return

    best = max(plates, key=lambda p: float(p.get("confidence", 0.0)))
    best_normalized = PlateNormalizer.sanitize(str(best.get("text", "")))

    if best_normalized:
        assert result["success"] is True
    else:
        assert result["success"] is False


# ---------------------------------------------------------------------------
# Property 4: batch structural invariant
# ---------------------------------------------------------------------------


@pytest.mark.property
@given(images=images_strategy)
@settings(max_examples=100)
def test_batch_structural_invariant(images):
    # Feature: lpd-pipeline-replacement, Property 4
    # For any N-element input: total == N, successful <= total,
    # len(results) == N, results[i]["image_index"] == i.
    # Validates: Requirements 6.1, 6.2, 6.4
    svc = _make_service(pipeline_return=[])
    result = svc.detect_base64_batch(images)

    n = len(images)
    assert result["total"] == n
    assert result["successful"] <= result["total"]
    assert len(result["results"]) == n
    for i, entry in enumerate(result["results"]):
        assert entry["image_index"] == i


# ---------------------------------------------------------------------------
# Property 5: sanitize() output character set
# ---------------------------------------------------------------------------


_ALLOWED_PATTERN = re.compile(r"^[A-Z0-9-]*$")


@pytest.mark.property
@given(s=st.text(min_size=1, max_size=50))
@settings(max_examples=100)
def test_sanitize_output_charset(s):
    # Feature: lpd-pipeline-replacement, Property 5
    # sanitize() returns only chars from [A-Z0-9-] (or empty string).
    # Validates: Requirements 7.1, 7.3
    result = PlateNormalizer.sanitize(s)
    assert _ALLOWED_PATTERN.match(result) is not None


# ---------------------------------------------------------------------------
# Property 6: sanitize() idempotence
# ---------------------------------------------------------------------------


@pytest.mark.property
@given(s=st.text(min_size=0, max_size=50))
@settings(max_examples=100)
def test_sanitize_idempotence(s):
    # Feature: lpd-pipeline-replacement, Property 6
    # sanitize(sanitize(s)) == sanitize(s) for any input string.
    # Validates: Requirements 7.2, 7.4
    once = PlateNormalizer.sanitize(s)
    twice = PlateNormalizer.sanitize(once)
    assert twice == once


# ---------------------------------------------------------------------------
# Property 7: HTTP plate_count consistency
# ---------------------------------------------------------------------------


@pytest.mark.property
@given(
    plates=st.lists(
        st.fixed_dictionaries(
            {
                "text": st.text(min_size=0, max_size=20),
                "bbox": st.lists(
                    st.floats(
                        min_value=0, max_value=1000, allow_nan=False, allow_infinity=False
                    ),
                    min_size=4,
                    max_size=4,
                ),
                "confidence": st.floats(
                    min_value=0.0, max_value=1.0, allow_nan=False, allow_infinity=False
                ),
            }
        ),
        min_size=1,
        max_size=5,
    )
)
@settings(max_examples=100)
def test_http_plate_count_consistency(plates):
    # Feature: lpd-pipeline-replacement, Property 7
    # For any mocked service returning N plates, POST /detect response has
    # plate_count == len(plates) in the JSON body.
    # Validates: Requirements 4.2
    from api_server import create_app

    fake_service = _FakeLPDService(plates)
    app = create_app(service=fake_service)
    client = app.test_client()

    # Build a minimal valid PNG to POST
    img = np.zeros((10, 10, 3), dtype=np.uint8)
    _, buf = cv2.imencode(".png", img)
    png_bytes = buf.tobytes()

    response = client.post(
        "/detect",
        data={"file": (io.BytesIO(png_bytes), "test.png", "image/png")},
        content_type="multipart/form-data",
    )

    assert response.status_code == 200
    body = response.get_json()
    assert body["plate_count"] == len(body["plates"])
