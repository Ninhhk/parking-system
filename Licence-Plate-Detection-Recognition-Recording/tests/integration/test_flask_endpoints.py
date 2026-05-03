"""Flask integration tests for the repo5-backed LPD API server.

Covers the full HTTP contract including error cases.
All tests use create_app(service=FakeLPDService()) — no .pt files loaded.
"""

from __future__ import annotations

import base64
from io import BytesIO
from pathlib import Path
from unittest.mock import patch

import cv2
import numpy as np
import pytest

from api_server import create_app
from services.repo5_lpd_service import Repo5LPDConfig


# ---------------------------------------------------------------------------
# Fake service stub
# ---------------------------------------------------------------------------


class FakeLPDService:
    def __init__(self, ready=True, load_error=None):
        self.config = Repo5LPDConfig(
            stage1_model_path=Path("repo5/model/license_plate_detector.pt"),
            stage2_model_path=Path("repo5/model/LP_ocr_yolov8.pt"),
        )
        self._ready = ready
        self._load_error = load_error

    def is_ready(self):
        return self._ready

    def ensure_ready(self):
        if self._load_error:
            raise RuntimeError(self._load_error)

    def detect_frame(self, frame):
        return {
            "plates": [{"text": "59L-12345", "bbox": [10.0, 20.0, 100.0, 60.0], "confidence": 0.92}],
            "plate_count": 1,
            "inference_time_ms": 12.5,
        }

    def detect_best_plate(self, frame):
        return {
            "success": True,
            "normalized_plate": "59L-12345",
            "raw_text": "59L-12345",
            "confidence": 0.92,
            "bbox": [10.0, 20.0, 100.0, 60.0],
            "detection_time_ms": 12.5,
        }

    def detect_base64_batch(self, images):
        results = [
            {"image_index": i, "success": True, "normalized_plate": "59L-12345"}
            for i, _ in enumerate(images)
        ]
        return {"success": True, "total": len(results), "successful": len(results), "results": results}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_png_bytes() -> bytes:
    img = np.zeros((48, 96, 3), dtype=np.uint8)
    _, buf = cv2.imencode(".png", img)
    return buf.tobytes()


def _make_client(ready=True, load_error=None):
    app = create_app(service=FakeLPDService(ready=ready, load_error=load_error))
    return app.test_client()


# ---------------------------------------------------------------------------
# 5.1 Health endpoint
# ---------------------------------------------------------------------------


class TestHealthEndpoint:
    """Requirements: 12.1, 3.3, 3.4"""

    def test_ready_service_returns_200_ok(self):
        client = _make_client(ready=True)
        response = client.get("/health")
        assert response.status_code == 200
        body = response.get_json()
        assert body["status"] == "ok"

    def test_load_failure_returns_503(self):
        client = _make_client(load_error="model missing")
        response = client.get("/health")
        assert response.status_code == 503
        body = response.get_json()
        assert body["status"] == "error"
        assert "error" in body


# ---------------------------------------------------------------------------
# 5.2 Multipart detect
# ---------------------------------------------------------------------------


class TestDetectMultipart:
    """Requirements: 12.2, 4.1, 4.6"""

    def test_valid_png_returns_200_with_correct_shape(self):
        client = _make_client()
        response = client.post(
            "/detect",
            data={"file": (BytesIO(_make_png_bytes()), "plate.png")},
            content_type="multipart/form-data",
        )
        assert response.status_code == 200
        body = response.get_json()
        assert "plates" in body
        assert "plate_count" in body
        assert "inference_time_ms" in body

    def test_missing_file_field_returns_400(self):
        client = _make_client()
        response = client.post("/detect", data={}, content_type="multipart/form-data")
        assert response.status_code == 400

    def test_non_image_bytes_returns_422(self):
        client = _make_client()
        response = client.post(
            "/detect",
            data={"file": (BytesIO(b"not-an-image"), "bad.bin")},
            content_type="multipart/form-data",
        )
        assert response.status_code == 422


# ---------------------------------------------------------------------------
# 5.3 Legacy base64 detect
# ---------------------------------------------------------------------------


class TestDetectLegacy:
    """Requirements: 12.3, 4.3, 4.4, 4.5"""

    def test_valid_base64_returns_200(self):
        client = _make_client()
        encoded = base64.b64encode(_make_png_bytes()).decode("ascii")
        response = client.post("/api/detect", json={"image": encoded})
        assert response.status_code == 200
        body = response.get_json()
        assert "success" in body
        assert "normalized_plate" in body
        assert "raw_text" in body
        assert "confidence" in body
        assert "bbox" in body
        assert "detection_time_ms" in body

    def test_missing_image_field_returns_400(self):
        client = _make_client()
        response = client.post("/api/detect", json={})
        assert response.status_code == 400
        assert response.get_json()["error"] == "Image data is required"

    def test_invalid_base64_returns_400(self):
        client = _make_client()
        response = client.post("/api/detect", json={"image": "!!!invalid!!!"})
        assert response.status_code == 400


# ---------------------------------------------------------------------------
# 5.4 Batch detect
# ---------------------------------------------------------------------------


class TestDetectBatch:
    """Requirements: 12.4, 4.7, 4.8, 4.9"""

    def test_two_image_batch_returns_200_with_total_2(self):
        client = _make_client()
        encoded = base64.b64encode(_make_png_bytes()).decode("ascii")
        response = client.post("/api/detect-batch", json={"images": [encoded, encoded]})
        assert response.status_code == 200
        assert response.get_json()["total"] == 2

    def test_empty_array_returns_400(self):
        client = _make_client()
        response = client.post("/api/detect-batch", json={"images": []})
        assert response.status_code == 400

    def test_eleven_images_returns_400(self):
        client = _make_client()
        encoded = base64.b64encode(_make_png_bytes()).decode("ascii")
        response = client.post("/api/detect-batch", json={"images": [encoded] * 11})
        assert response.status_code == 400
        assert response.get_json()["error"] == "Maximum 10 images per batch"


# ---------------------------------------------------------------------------
# 5.5 Metrics and config
# ---------------------------------------------------------------------------


class TestMetricsConfig:
    """Requirements: 12.5, 9.1, 8.3"""

    def test_metrics_returns_200_with_expected_keys(self):
        try:
            import psutil  # noqa: F401
        except ImportError:
            pytest.skip("psutil not installed")

        client = _make_client()
        response = client.get("/api/metrics")
        assert response.status_code == 200
        body = response.get_json()
        assert "memory" in body
        assert "cpu_percent" in body
        assert "num_threads" in body

    def test_config_returns_200_with_expected_keys(self):
        client = _make_client()
        response = client.get("/api/config")
        assert response.status_code == 200
        body = response.get_json()
        assert "service" in body
        assert "version" in body
        assert "models" in body
        assert "capabilities" in body


# ---------------------------------------------------------------------------
# 5.6 Error handlers
# ---------------------------------------------------------------------------


class TestErrorHandlers:
    """Requirements: 1.3, 1.4"""

    def test_undefined_route_returns_404(self):
        client = _make_client()
        response = client.get("/nonexistent")
        assert response.status_code == 404
        assert response.get_json() == {"success": False, "error": "Endpoint not found"}

    def test_unhandled_exception_returns_500(self):
        service = FakeLPDService()
        app = create_app(service=service)
        client = app.test_client()

        with patch.object(service, "detect_frame", side_effect=Exception("boom")):
            response = client.post(
                "/detect",
                data={"file": (BytesIO(_make_png_bytes()), "plate.png")},
                content_type="multipart/form-data",
            )

        assert response.status_code == 500
        assert response.get_json() == {"success": False, "error": "boom"}
