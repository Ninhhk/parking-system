"""Unit tests for api/app.py — FastAPI application.

Tests use starlette TestClient with mocked models so no real .pt files
are required.  The lifespan startup is bypassed by directly setting
app.state attributes before each test.
"""
import sys
import os
from io import BytesIO
from unittest.mock import MagicMock, patch

import cv2
import numpy as np
import pytest

# Ensure repo5 root is importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from fastapi.testclient import TestClient


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_png_bytes(height: int = 64, width: int = 64) -> bytes:
    """Create a small valid PNG image in memory and return its bytes."""
    img = np.zeros((height, width, 3), dtype=np.uint8)
    # Add some non-black pixels so it's a realistic image
    img[10:20, 10:20] = (200, 100, 50)
    ok, buf = cv2.imencode(".png", img)
    assert ok, "cv2.imencode failed in test helper"
    return buf.tobytes()


def _make_app_with_mock_models():
    """Import the app and inject mock models into app.state, bypassing lifespan."""
    # We need to patch load_stage1/load_stage2 so the lifespan doesn't try
    # to load real model files.
    mock_stage1 = MagicMock()
    mock_stage2 = MagicMock()

    with patch("api.app.load_stage1", return_value=mock_stage1), \
         patch("api.app.load_stage2", return_value=mock_stage2):
        # Re-import to pick up patches (or use the already-imported module)
        from api.app import app
        # Use TestClient as context manager to trigger lifespan
        client = TestClient(app)
    return client, mock_stage1, mock_stage2


# ---------------------------------------------------------------------------
# GET /health
# ---------------------------------------------------------------------------

class TestHealthEndpoint:
    def test_health_returns_200(self):
        with patch("api.app.load_stage1", return_value=MagicMock()), \
             patch("api.app.load_stage2", return_value=MagicMock()):
            from api.app import app
            with TestClient(app) as client:
                response = client.get("/health")
        assert response.status_code == 200

    def test_health_returns_correct_schema(self):
        with patch("api.app.load_stage1", return_value=MagicMock()), \
             patch("api.app.load_stage2", return_value=MagicMock()):
            from api.app import app
            with TestClient(app) as client:
                response = client.get("/health")
        data = response.json()
        assert data["status"] == "ok"
        assert data["stage1"] == "yolov8"
        assert data["stage2"] == "yolov5"

    def test_health_has_all_required_fields(self):
        with patch("api.app.load_stage1", return_value=MagicMock()), \
             patch("api.app.load_stage2", return_value=MagicMock()):
            from api.app import app
            with TestClient(app) as client:
                response = client.get("/health")
        data = response.json()
        assert "status" in data
        assert "stage1" in data
        assert "stage2" in data


# ---------------------------------------------------------------------------
# POST /detect — invalid bytes → 422
# ---------------------------------------------------------------------------

class TestDetectInvalidInput:
    def test_invalid_bytes_returns_422(self):
        invalid_bytes = b"this is not an image"
        with patch("api.app.load_stage1", return_value=MagicMock()), \
             patch("api.app.load_stage2", return_value=MagicMock()):
            from api.app import app
            with TestClient(app) as client:
                response = client.post(
                    "/detect",
                    files={"file": ("bad.bin", invalid_bytes, "application/octet-stream")},
                )
        assert response.status_code == 422

    def test_empty_bytes_returns_422(self):
        with patch("api.app.load_stage1", return_value=MagicMock()), \
             patch("api.app.load_stage2", return_value=MagicMock()):
            from api.app import app
            with TestClient(app) as client:
                response = client.post(
                    "/detect",
                    files={"file": ("empty.png", b"", "image/png")},
                )
        assert response.status_code == 422


# ---------------------------------------------------------------------------
# POST /detect — valid image with no plates → plates: [], plate_count: 0
# ---------------------------------------------------------------------------

class TestDetectNoPlates:
    def test_no_plate_image_returns_empty_plates(self):
        """A valid image where run_pipeline returns [] → plates:[], plate_count:0."""
        png_bytes = _make_png_bytes()

        mock_stage1 = MagicMock()
        mock_stage2 = MagicMock()

        with patch("api.app.load_stage1", return_value=mock_stage1), \
             patch("api.app.load_stage2", return_value=mock_stage2), \
             patch("api.app.run_pipeline", return_value=[]) as mock_pipeline:
            from api.app import app
            with TestClient(app) as client:
                response = client.post(
                    "/detect",
                    files={"file": ("test.png", png_bytes, "image/png")},
                )

        assert response.status_code == 200
        data = response.json()
        assert data["plates"] == []
        assert data["plate_count"] == 0

    def test_no_plate_response_has_inference_time(self):
        """Even with no plates, inference_time_ms must be present and > 0."""
        png_bytes = _make_png_bytes()

        with patch("api.app.load_stage1", return_value=MagicMock()), \
             patch("api.app.load_stage2", return_value=MagicMock()), \
             patch("api.app.run_pipeline", return_value=[]):
            from api.app import app
            with TestClient(app) as client:
                response = client.post(
                    "/detect",
                    files={"file": ("test.png", png_bytes, "image/png")},
                )

        data = response.json()
        assert "inference_time_ms" in data
        assert data["inference_time_ms"] >= 0


# ---------------------------------------------------------------------------
# POST /detect — valid image with plates
# ---------------------------------------------------------------------------

class TestDetectWithPlates:
    def test_detect_returns_plate_results(self):
        """When run_pipeline returns plates, they appear in the response."""
        png_bytes = _make_png_bytes()
        fake_plates = [
            {"text": "59L-12345", "bbox": [10.0, 20.0, 100.0, 60.0], "confidence": 0.92}
        ]

        with patch("api.app.load_stage1", return_value=MagicMock()), \
             patch("api.app.load_stage2", return_value=MagicMock()), \
             patch("api.app.run_pipeline", return_value=fake_plates):
            from api.app import app
            with TestClient(app) as client:
                response = client.post(
                    "/detect",
                    files={"file": ("plate.png", png_bytes, "image/png")},
                )

        assert response.status_code == 200
        data = response.json()
        assert data["plate_count"] == 1
        assert len(data["plates"]) == 1
        assert data["plates"][0]["text"] == "59L-12345"
        assert data["plates"][0]["confidence"] == pytest.approx(0.92)

    def test_plate_count_equals_len_plates(self):
        """plate_count must always equal len(plates)."""
        png_bytes = _make_png_bytes()
        fake_plates = [
            {"text": "59L-12345", "bbox": [10.0, 20.0, 100.0, 60.0], "confidence": 0.92},
            {"text": "30A-99999", "bbox": [200.0, 20.0, 300.0, 60.0], "confidence": 0.85},
        ]

        with patch("api.app.load_stage1", return_value=MagicMock()), \
             patch("api.app.load_stage2", return_value=MagicMock()), \
             patch("api.app.run_pipeline", return_value=fake_plates):
            from api.app import app
            with TestClient(app) as client:
                response = client.post(
                    "/detect",
                    files={"file": ("plates.png", png_bytes, "image/png")},
                )

        data = response.json()
        assert data["plate_count"] == len(data["plates"])
