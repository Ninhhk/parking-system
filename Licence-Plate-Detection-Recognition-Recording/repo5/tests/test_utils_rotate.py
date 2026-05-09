"""Unit tests for function/utils_rotate.py — Deskew_Processor."""
import sys
import os
from unittest.mock import patch

import numpy as np
import pytest

# Ensure repo5 root is on the path so `function.utils_rotate` is importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from function.utils_rotate import deskew, compute_skew, rotate_image


# ---------------------------------------------------------------------------
# deskew — contrast enhancement gating (Requirements: 5.4)
# ---------------------------------------------------------------------------

class TestDeskewChangeContrast:
    def test_cc0_does_not_call_changeContrast(self):
        """When change_cons=0, deskew must NOT call changeContrast."""
        img = np.zeros((50, 100, 3), dtype=np.uint8)
        with patch("function.utils_rotate.changeContrast") as mock_cc:
            deskew(img, change_cons=0, center_thres=0)
            mock_cc.assert_not_called()

    def test_cc1_calls_changeContrast(self):
        """Sanity check: when change_cons=1, changeContrast IS called."""
        img = np.zeros((50, 100, 3), dtype=np.uint8)
        with patch("function.utils_rotate.changeContrast", return_value=img) as mock_cc:
            deskew(img, change_cons=1, center_thres=0)
            mock_cc.assert_called_once()


# ---------------------------------------------------------------------------
# compute_skew — blank image / no lines path (Requirements: 5.5)
# ---------------------------------------------------------------------------

class TestComputeSkewBlankImage:
    def test_blank_image_returns_1(self):
        """A blank (all-zeros) image has no edges → HoughLinesP returns None → returns 1."""
        blank = np.zeros((50, 100, 3), dtype=np.uint8)
        result = compute_skew(blank, center_thres=0)
        # No lines found → function returns 1
        assert result == 1

    def test_blank_grayscale_image_returns_1(self):
        """Same behaviour for a 2D (grayscale) blank image."""
        blank = np.zeros((50, 100), dtype=np.uint8)
        result = compute_skew(blank, center_thres=0)
        assert result == 1


# ---------------------------------------------------------------------------
# rotate_image — identity rotation (Requirements: 5.3)
# ---------------------------------------------------------------------------

class TestRotateImageAngleZero:
    def test_angle0_preserves_shape(self):
        """rotate_image with angle=0 must return an array with the same shape."""
        img = np.random.randint(0, 256, (60, 120, 3), dtype=np.uint8)
        result = rotate_image(img, 0)
        assert result.shape == img.shape

    def test_angle0_preserves_pixel_values(self):
        """rotate_image with angle=0 should return near-identical pixel values."""
        img = np.random.randint(0, 256, (60, 120, 3), dtype=np.uint8)
        result = rotate_image(img, 0)
        np.testing.assert_array_almost_equal(result, img, decimal=0)

    def test_angle0_uniform_image_unchanged(self):
        """A uniform-colour image rotated by 0 degrees must be identical."""
        img = np.full((40, 80, 3), 128, dtype=np.uint8)
        result = rotate_image(img, 0)
        np.testing.assert_array_equal(result, img)
