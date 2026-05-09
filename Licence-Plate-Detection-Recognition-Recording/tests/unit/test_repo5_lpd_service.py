"""Unit tests for Repo5LPDService and LazyRepo5LPDService.

All tests inject mock stage1/stage2 — no .pt files loaded.
"""

from __future__ import annotations

import base64
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import cv2
import numpy as np
import pytest

from services.repo5_lpd_service import Repo5LPDService


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_valid_b64() -> str:
    """Encode a tiny black PNG as base64."""
    img = np.zeros((10, 10, 3), dtype=np.uint8)
    _, buf = cv2.imencode(".png", img)
    return base64.b64encode(buf.tobytes()).decode()


def _make_service(pipeline_return=None, stage1=None, stage2=None) -> Repo5LPDService:
    """Build a Repo5LPDService with mocked internals."""
    mock_stage1 = stage1 or MagicMock()
    mock_stage2 = stage2 or MagicMock()
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
# 3.1 TestDetectFrame — Requirements 11.1, 5.1, 5.2
# ---------------------------------------------------------------------------


class TestDetectFrame:
    def test_valid_frame_returns_correct_keys(self):
        svc = _make_service()
        result = svc.detect_frame(_valid_frame())
        assert set(result.keys()) == {"plates", "plate_count", "inference_time_ms"}

    def test_empty_frame_raises_value_error(self):
        svc = _make_service()
        with pytest.raises(ValueError):
            svc.detect_frame(np.array([]))

    def test_plate_count_equals_len_plates(self):
        plates = [
            {"text": "59L-12345", "bbox": [0, 0, 10, 10], "confidence": 0.9},
            {"text": "51G-39466", "bbox": [0, 0, 10, 10], "confidence": 0.8},
        ]
        svc = _make_service(pipeline_return=plates)
        result = svc.detect_frame(_valid_frame())
        assert result["plate_count"] == len(result["plates"]) == 2


# ---------------------------------------------------------------------------
# 3.2 TestDetectBestPlate — Requirements 11.2, 5.3, 5.4, 5.5
# ---------------------------------------------------------------------------


class TestDetectBestPlate:
    def test_no_plates_returns_failure(self):
        svc = _make_service(pipeline_return=[])
        result = svc.detect_best_plate(_valid_frame())
        assert result["success"] is False
        assert "error" in result

    def test_empty_normalized_text_returns_failure(self):
        # "---" sanitizes to "" after stripping hyphens
        plates = [{"text": "---", "bbox": [0, 0, 10, 10], "confidence": 0.9}]
        svc = _make_service(pipeline_return=plates)
        result = svc.detect_best_plate(_valid_frame())
        assert result["success"] is False

    def test_valid_plate_returns_success(self):
        plates = [{"text": "59L-12345", "bbox": [0, 0, 10, 10], "confidence": 0.9}]
        svc = _make_service(pipeline_return=plates)
        result = svc.detect_best_plate(_valid_frame())
        assert result["success"] is True
        assert result["normalized_plate"]  # non-empty


# ---------------------------------------------------------------------------
# 3.3 TestDetectBase64Batch — Requirements 11.3, 6.1, 6.2, 6.3, 6.4
# ---------------------------------------------------------------------------


class TestDetectBase64Batch:
    def test_all_success_batch(self):
        plates = [{"text": "59L-12345", "bbox": [0, 0, 10, 10], "confidence": 0.9}]
        svc = _make_service(pipeline_return=plates)
        b64 = _make_valid_b64()
        result = svc.detect_base64_batch([b64, b64])
        assert result["total"] == 2
        assert result["successful"] == 2
        assert len(result["results"]) == 2

    def test_partial_failure_batch(self):
        plates = [{"text": "59L-12345", "bbox": [0, 0, 10, 10], "confidence": 0.9}]
        svc = _make_service(pipeline_return=plates)
        b64 = _make_valid_b64()
        result = svc.detect_base64_batch([b64, "!!!not-valid-base64!!!"])
        assert result["total"] == 2
        assert result["successful"] == 1
        assert len(result["results"]) == 2

    def test_empty_string_image_entry(self):
        svc = _make_service()
        result = svc.detect_base64_batch([""])
        assert result["total"] == 1
        assert result["successful"] == 0
        assert result["results"][0]["success"] is False


# ---------------------------------------------------------------------------
# 3.4 TestDetectBase64Image — Requirements 11.4
# ---------------------------------------------------------------------------


class TestDetectBase64Image:
    def test_valid_base64_png_decodes(self):
        plates = [{"text": "59L-12345", "bbox": [0, 0, 10, 10], "confidence": 0.9}]
        svc = _make_service(pipeline_return=plates)
        b64 = _make_valid_b64()
        # Should not raise
        svc.detect_base64_image(b64)

    def test_data_url_prefix_stripped(self):
        plates = [{"text": "59L-12345", "bbox": [0, 0, 10, 10], "confidence": 0.9}]
        svc = _make_service(pipeline_return=plates)
        b64 = _make_valid_b64()
        data_url = f"data:image/png;base64,{b64}"
        # Should not raise
        svc.detect_base64_image(data_url)

    def test_invalid_base64_raises_value_error(self):
        svc = _make_service()
        with pytest.raises(ValueError):
            svc.detect_base64_image("not-valid-base64!!!")


# ---------------------------------------------------------------------------
# 3.5 TestLazyService — Requirements 3.1, 3.2
# ---------------------------------------------------------------------------


class TestLazyService:
    def test_defers_construction_until_first_call(self):
        from api_server import LazyRepo5LPDService

        lazy = LazyRepo5LPDService.__new__(LazyRepo5LPDService)
        lazy._service = None
        lazy._load_error = None
        lazy.config = MagicMock()

        assert lazy._service is None

        mock_svc = MagicMock()
        mock_svc.is_ready.return_value = True
        with patch("api_server.Repo5LPDService", return_value=mock_svc):
            lazy.ensure_ready()

        assert lazy._service is not None

    def test_cached_error_reraised_without_retry(self):
        from api_server import LazyRepo5LPDService

        lazy = LazyRepo5LPDService.__new__(LazyRepo5LPDService)
        lazy._service = None
        lazy._load_error = RuntimeError("model load failed")
        lazy.config = MagicMock()

        with pytest.raises(RuntimeError):
            lazy.ensure_ready()

        # Second call also raises without retrying
        with pytest.raises(RuntimeError):
            lazy.ensure_ready()
