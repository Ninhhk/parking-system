"""Pytest configuration and shared fixtures."""
import pytest
import numpy as np
import cv2
from pathlib import Path


@pytest.fixture
def sample_image():
    """Create a sample test image."""
    img = np.zeros((480, 640, 3), dtype=np.uint8)
    # Add some content to make it realistic
    cv2.rectangle(img, (200, 180), (440, 280), (255, 255, 255), -1)
    cv2.putText(img, "51G-39466", (220, 240), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 0), 2)
    return img


@pytest.fixture
def mock_api_response_success():
    """Mock successful API response."""
    return {
        "success": True,
        "ticket": {
            "session_id": 123,
            "license_plate": "51G-39466",
            "time_in": "2025-12-05T10:30:00",
            "is_monthly": False,
            "lot_id": 1,
            "lot_name": "Main Parking"
        }
    }


@pytest.fixture
def mock_api_response_error():
    """Mock error API response."""
    return {
        "success": False,
        "error": "Parking lot is full"
    }


@pytest.fixture
def test_fixtures_dir():
    """Return path to test fixtures directory."""
    return Path(__file__).parent / "fixtures"
