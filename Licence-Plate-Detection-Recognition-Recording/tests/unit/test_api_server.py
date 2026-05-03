"""Unit tests for the repo5-backed Flask API server."""

from __future__ import annotations

import base64
from io import BytesIO
from pathlib import Path

import cv2
import numpy as np

from api_server import create_app, LPDServerConfig
from services.repo5_lpd_service import Repo5LPDConfig


def _make_png_bytes() -> bytes:
    image = np.zeros((48, 96, 3), dtype=np.uint8)
    image[10:20, 10:30] = (255, 255, 255)
    success, buffer = cv2.imencode(".png", image)
    assert success
    return buffer.tobytes()


class FakeLPDService:
    def __init__(self):
        self.config = Repo5LPDConfig(
            stage1_model_path=Path("repo5/model/license_plate_detector.pt"),
            stage2_model_path=Path("repo5/model/LP_ocr_yolov8.pt"),
        )

    def is_ready(self):
        return True

    def ensure_ready(self):
        return None

    def detect_frame(self, frame):
        return {
            "plates": [
                {
                    "text": "59L-12345",
                    "bbox": [10.0, 20.0, 100.0, 60.0],
                    "confidence": 0.92,
                }
            ],
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
        results = []
        for index, _image in enumerate(images):
            results.append(
                {
                    "image_index": index,
                    "success": True,
                    "normalized_plate": f"59L-1234{index}",
                    "raw_text": f"59L-1234{index}",
                    "confidence": 0.9,
                }
            )
        return {
            "success": True,
            "total": len(results),
            "successful": len(results),
            "results": results,
        }


def _create_client():
    app = create_app(
        service=FakeLPDService(),
        server_config=LPDServerConfig(host="127.0.0.1", port=5000, debug=False),
    )
    return app.test_client()


def test_health_reports_ready_state():
    client = _create_client()

    response = client.get("/health")

    assert response.status_code == 200
    assert response.get_json() == {
        "status": "ok",
        "service": "repo5-lpd",
        "stage1": "loaded",
        "stage2": "loaded",
    }


def test_multipart_detect_returns_repo5_shape():
    client = _create_client()
    image_bytes = _make_png_bytes()

    response = client.post(
        "/detect",
        data={"file": (BytesIO(image_bytes), "plate.png")},
        content_type="multipart/form-data",
    )

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["plate_count"] == 1
    assert payload["plates"][0]["text"] == "59L-12345"
    assert payload["plates"][0]["bbox"] == [10.0, 20.0, 100.0, 60.0]


def test_legacy_detect_returns_normalized_plate():
    client = _create_client()
    image_bytes = _make_png_bytes()

    image_string = base64.b64encode(image_bytes).decode("ascii")

    response = client.post(
        "/api/detect",
        json={"image": image_string},
    )

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["success"] is True
    assert payload["normalized_plate"] == "59L-12345"
    assert payload["raw_text"] == "59L-12345"


def test_legacy_detect_requires_image():
    client = _create_client()

    response = client.post("/api/detect", json={})

    assert response.status_code == 400
    assert response.get_json()["error"] == "Image data is required"


def test_batch_detect_returns_all_results():
    client = _create_client()
    image_bytes = _make_png_bytes()

    encoded = base64.b64encode(image_bytes).decode("ascii")

    response = client.post(
        "/api/detect-batch",
        json={"images": [encoded, encoded]},
    )

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["total"] == 2
    assert payload["successful"] == 2
    assert len(payload["results"]) == 2


def test_multipart_detect_rejects_invalid_image_bytes():
    client = _create_client()

    response = client.post(
        "/detect",
        data={"file": (BytesIO(b"not-an-image"), "bad.bin")},
        content_type="multipart/form-data",
    )

    assert response.status_code == 422
