"""Unit tests for EvalConfig."""

import os
from pathlib import Path

import pytest

from evaluation.eval_config import EvalConfig


class TestEvalConfigFromEnv:
    """Test EvalConfig.from_env resolution."""

    def test_default_paths_resolve(self):
        """Defaults produce correct nested structure."""
        cfg = EvalConfig.from_env()
        assert cfg.ocr_images_dir.name == "val"
        assert cfg.ocr_images_dir.parent.name == "images"
        assert cfg.ocr_labels_dir.name == "val"
        assert cfg.ocr_labels_dir.parent.name == "labels"
        assert cfg.det_images_dir.name == "val"
        assert cfg.det_labels_dir.name == "val"
        assert cfg.output_dir.name == "results"

    def test_env_override_ocr(self, monkeypatch, tmp_path):
        """EVAL_OCR_DATASET env var overrides OCR paths."""
        fake = tmp_path / "ocr_data"
        fake.mkdir()
        monkeypatch.setenv("EVAL_OCR_DATASET", str(fake))
        cfg = EvalConfig.from_env()
        assert cfg.ocr_images_dir == fake / "images" / "val"
        assert cfg.ocr_labels_dir == fake / "labels" / "val"

    def test_env_override_det(self, monkeypatch, tmp_path):
        """EVAL_DET_DATASET env var overrides detection paths."""
        fake = tmp_path / "det_data"
        fake.mkdir()
        monkeypatch.setenv("EVAL_DET_DATASET", str(fake))
        cfg = EvalConfig.from_env()
        assert cfg.det_images_dir == fake / "images" / "val"
        assert cfg.det_labels_dir == fake / "labels" / "val"

    def test_env_override_output(self, monkeypatch, tmp_path):
        """EVAL_OUTPUT_DIR env var overrides output path."""
        out = tmp_path / "my_results"
        monkeypatch.setenv("EVAL_OUTPUT_DIR", str(out))
        cfg = EvalConfig.from_env()
        assert cfg.output_dir == out

    def test_ensure_output_dir_creates(self, monkeypatch, tmp_path):
        """ensure_output_dir creates the directory."""
        out = tmp_path / "new_dir"
        monkeypatch.setenv("EVAL_OUTPUT_DIR", str(out))
        cfg = EvalConfig.from_env()
        assert not out.exists()
        cfg.ensure_output_dir()
        assert out.exists()

    def test_frozen_immutability(self):
        """Config is immutable (frozen dataclass)."""
        cfg = EvalConfig.from_env()
        with pytest.raises(Exception):
            cfg.output_dir = Path("/tmp")
