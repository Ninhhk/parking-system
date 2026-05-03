"""HTTP API for the repo5-backed license plate detection service."""

from __future__ import annotations

import base64
import binascii
import os
from dataclasses import dataclass
from typing import Any

import cv2
import numpy as np
from flask import Flask, jsonify, request

from services.repo5_lpd_service import Repo5LPDConfig, Repo5LPDService


@dataclass(frozen=True)
class LPDServerConfig:
    """Transport-level settings for the API server."""

    host: str = os.getenv("LPD_API_HOST", "0.0.0.0")
    port: int = int(os.getenv("LPD_API_PORT", "5000"))
    debug: bool = os.getenv("LPD_API_DEBUG", "false").lower() == "true"


class LazyRepo5LPDService:
    """Proxy that initializes the repo5 pipeline only when it is needed."""

    def __init__(self, config: Repo5LPDConfig | None = None):
        self.config = config or Repo5LPDConfig.from_env()
        self._service: Repo5LPDService | None = None
        self._load_error: Exception | None = None

    def _get_service(self) -> Repo5LPDService:
        if self._service is not None:
            return self._service

        if self._load_error is not None:
            raise RuntimeError(str(self._load_error)) from self._load_error

        try:
            self._service = Repo5LPDService(config=self.config)
            return self._service
        except Exception as exc:
            self._load_error = exc
            raise RuntimeError(str(exc)) from exc

    def is_ready(self) -> bool:
        return self._service.is_ready() if self._service is not None else False

    def ensure_ready(self) -> None:
        self._get_service().ensure_ready()

    def detect_frame(self, frame: np.ndarray) -> dict:
        return self._get_service().detect_frame(frame)

    def detect_best_plate(self, frame: np.ndarray) -> dict:
        return self._get_service().detect_best_plate(frame)

    def detect_base64_batch(self, images):
        return self._get_service().detect_base64_batch(images)


def _decode_image_bytes(raw_bytes: bytes) -> np.ndarray:
    if not raw_bytes:
        raise ValueError("Uploaded file is empty. Please upload a valid image.")

    image_buffer = np.frombuffer(raw_bytes, dtype=np.uint8)
    frame = cv2.imdecode(image_buffer, cv2.IMREAD_COLOR)
    if frame is None:
        raise ValueError(
            "Could not decode the uploaded file as an image. Please upload a valid image."
        )

    return frame


def _decode_base64_image(image_data: str) -> np.ndarray:
    if not isinstance(image_data, str) or not image_data.strip():
        raise ValueError("Image data is required")

    cleaned = image_data.strip()
    if cleaned.startswith("data:image") and "," in cleaned:
        cleaned = cleaned.split(",", 1)[1]

    try:
        raw_bytes = base64.b64decode(cleaned, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise ValueError("Failed to decode image: invalid base64 data") from exc

    return _decode_image_bytes(raw_bytes)


def _build_health_payload(service: Repo5LPDService) -> dict[str, Any]:
    ready = service.is_ready()
    return {
        "status": "ok" if ready else "starting",
        "service": "repo5-lpd",
        "stage1": "loaded" if ready else "not_loaded",
        "stage2": "loaded" if ready else "not_loaded",
    }


def _build_config_payload(config: LPDServerConfig, service_config: Repo5LPDConfig) -> dict[str, Any]:
    return {
        "service": "repo5-lpd",
        "version": "2.0.0",
        "host": config.host,
        "port": config.port,
        "debug": config.debug,
        "models": {
            "stage1": str(service_config.stage1_model_path),
            "stage2": str(service_config.stage2_model_path),
        },
        "capabilities": [
            "multipart-detect",
            "legacy-base64-detect",
            "batch-detect",
            "health-check",
        ],
    }


def create_app(
    service: Repo5LPDService | None = None,
    server_config: LPDServerConfig | None = None,
) -> Flask:
    """Build a Flask app around the repo5 detection service."""
    app = Flask(__name__)
    lpd_service = service or LazyRepo5LPDService()
    transport_config = server_config or LPDServerConfig()

    @app.route("/health", methods=["GET"])
    def health_check():
        try:
            lpd_service.ensure_ready()
        except Exception as exc:
            payload = _build_health_payload(lpd_service)
            payload["status"] = "error"
            payload["error"] = str(exc)
            return jsonify(payload), 503

        return jsonify(_build_health_payload(lpd_service)), 200

    @app.route("/detect", methods=["POST"])
    def detect_multipart():
        uploaded_file = request.files.get("file")
        if uploaded_file is None:
            return jsonify({"success": False, "error": "Image file is required"}), 400

        try:
            frame = _decode_image_bytes(uploaded_file.read())
            result = lpd_service.detect_frame(frame)
            return jsonify(result), 200
        except ValueError as exc:
            return jsonify({"success": False, "error": str(exc)}), 422
        except Exception as exc:
            return jsonify({"success": False, "error": str(exc)}), 500

    @app.route("/api/detect", methods=["POST"])
    def detect_legacy():
        payload = request.get_json(silent=True) or {}
        image_data = payload.get("image")

        if image_data is None:
            return jsonify({"success": False, "error": "Image data is required"}), 400

        try:
            frame = _decode_base64_image(image_data)
            result = lpd_service.detect_best_plate(frame)
            if not result.get("success"):
                return jsonify(result), 422
            return jsonify(result), 200
        except ValueError as exc:
            return jsonify({"success": False, "error": str(exc)}), 400
        except Exception as exc:
            return jsonify({"success": False, "error": str(exc)}), 500

    @app.route("/api/detect-batch", methods=["POST"])
    def detect_batch():
        payload = request.get_json(silent=True) or {}
        images = payload.get("images")

        if not isinstance(images, list):
            return jsonify({"success": False, "error": "Images array is required"}), 400

        if len(images) == 0:
            return jsonify({"success": False, "error": "At least one image is required"}), 400

        if len(images) > 10:
            return jsonify({"success": False, "error": "Maximum 10 images per batch"}), 400

        return jsonify(lpd_service.detect_base64_batch(images)), 200

    @app.route("/api/metrics", methods=["GET"])
    def get_metrics():
        try:
            import psutil

            process = psutil.Process(os.getpid())
            memory_info = process.memory_info()

            return jsonify(
                {
                    "success": True,
                    "memory": {
                        "rss_mb": round(memory_info.rss / 1024 / 1024, 2),
                        "vms_mb": round(memory_info.vms / 1024 / 1024, 2),
                        "percent": round(process.memory_percent(), 2),
                    },
                    "cpu_percent": process.cpu_percent(interval=0.1),
                    "num_threads": process.num_threads(),
                }
            ), 200
        except ImportError:
            return jsonify({"success": False, "error": "psutil not installed"}), 500
        except Exception as exc:
            return jsonify({"success": False, "error": str(exc)}), 500

    @app.route("/api/config", methods=["GET"])
    def get_config():
        return jsonify(_build_config_payload(transport_config, lpd_service.config)), 200

    @app.errorhandler(404)
    def not_found(_error):
        return jsonify({"success": False, "error": "Endpoint not found"}), 404

    @app.errorhandler(500)
    def internal_error(_error):
        return jsonify({"success": False, "error": "Internal server error"}), 500

    return app


app = create_app()


if __name__ == "__main__":
    server_config = LPDServerConfig()
    print(f"Starting repo5-backed LPD API on {server_config.host}:{server_config.port}")
    print("Endpoints:")
    print("  GET  /health")
    print("  POST /detect")
    print("  POST /api/detect")
    print("  POST /api/detect-batch")
    print("  GET  /api/metrics")
    print("  GET  /api/config")
    app.run(host=server_config.host, port=server_config.port, debug=server_config.debug)
