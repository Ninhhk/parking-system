"""Unit tests for detection eval (data.yaml generation, no model)."""

import json
from pathlib import Path

import pytest
import yaml

from evaluation.detection_eval import generate_data_yaml, write_results


class TestGenerateDataYaml:
    """Test YOLO data.yaml generation."""

    def test_generates_valid_yaml(self, tmp_path):
        """Produces a readable YAML with correct keys."""
        images_dir = tmp_path / "LP" / "images" / "val"
        labels_dir = tmp_path / "LP" / "labels" / "val"
        images_dir.mkdir(parents=True)
        labels_dir.mkdir(parents=True)

        output = tmp_path / "data.yaml"
        result = generate_data_yaml(images_dir, labels_dir, output)

        assert result == output
        assert output.exists()

        with open(output) as f:
            data = yaml.safe_load(f)

        assert data["nc"] == 1
        assert data["names"] == ["license_plate"]
        assert "val" in data
        assert "path" in data

    def test_path_points_to_dataset_root(self, tmp_path):
        """path should be the dataset root (parent of images/)."""
        images_dir = tmp_path / "dataset" / "images" / "val"
        labels_dir = tmp_path / "dataset" / "labels" / "val"
        images_dir.mkdir(parents=True)
        labels_dir.mkdir(parents=True)

        output = tmp_path / "data.yaml"
        generate_data_yaml(images_dir, labels_dir, output)

        with open(output) as f:
            data = yaml.safe_load(f)

        assert data["path"] == str(tmp_path / "dataset")

    def test_val_is_relative_path(self, tmp_path):
        """val should be a relative path (images/val)."""
        images_dir = tmp_path / "ds" / "images" / "val"
        labels_dir = tmp_path / "ds" / "labels" / "val"
        images_dir.mkdir(parents=True)
        labels_dir.mkdir(parents=True)

        output = tmp_path / "data.yaml"
        generate_data_yaml(images_dir, labels_dir, output)

        with open(output) as f:
            data = yaml.safe_load(f)

        # Should be relative, containing "images" and "val"
        val_path = data["val"]
        assert "images" in val_path
        assert "val" in val_path

    def test_creates_parent_dirs(self, tmp_path):
        """Creates output parent directories if they don't exist."""
        images_dir = tmp_path / "ds" / "images" / "val"
        labels_dir = tmp_path / "ds" / "labels" / "val"
        images_dir.mkdir(parents=True)
        labels_dir.mkdir(parents=True)

        output = tmp_path / "nested" / "dir" / "data.yaml"
        generate_data_yaml(images_dir, labels_dir, output)
        assert output.exists()


class TestWriteResults:
    """Test JSON result writing."""

    def test_writes_valid_json(self, tmp_path):
        metrics = {"mAP50": 0.95, "precision": 0.92, "recall": 0.88}
        output = tmp_path / "results.json"
        write_results(metrics, output)

        assert output.exists()
        with open(output) as f:
            loaded = json.load(f)
        assert loaded == metrics

    def test_creates_parent_dirs(self, tmp_path):
        output = tmp_path / "deep" / "path" / "results.json"
        write_results({"mAP50": 0.5}, output)
        assert output.exists()
