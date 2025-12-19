"""Integration tests for complete plate capture workflow."""
import pytest
import numpy as np
import cv2
from pathlib import Path
from unittest.mock import Mock, patch

from config.settings import AppConfig, ModelConfig, APIConfig
from services import PlateNormalizer, ParkingAPIClient, PlateCaptureService
from services.plate_capture_service import DetectionError, PlateCaptureError


@pytest.fixture
def test_config(tmp_path):
    """Create test configuration."""
    # Create dummy model file
    model_path = tmp_path / "models" / "best.pt"
    model_path.parent.mkdir(parents=True)
    model_path.touch()
    
    # Create test image
    image_path = tmp_path / "test.jpg"
    test_img = np.zeros((480, 640, 3), dtype=np.uint8)
    cv2.imwrite(str(image_path), test_img)
    
    # Create output directory
    output_dir = tmp_path / "outputs"
    
    return AppConfig(
        model=ModelConfig(plate_model_path=model_path),
        api=APIConfig(),
        mode="image",
        image_path=image_path,
        dry_run=True,
        output_dir=output_dir,
        save_images=True
    )


@pytest.fixture
def mock_detector():
    """Create mock detector."""
    detector = Mock()
    detector.detect_frame.return_value = (
        [[100, 100, 200, 150]],  # bbox_list
        ["51G-39466"]             # text_list
    )
    return detector


@pytest.fixture
def normalizer():
    """Create normalizer instance."""
    return PlateNormalizer()


class TestPlateCaptureServiceIntegration:
    """Integration tests for plate capture service."""
    
    def test_load_image_success(self, test_config, mock_detector, normalizer):
        """Test loading image from file."""
        service = PlateCaptureService(
            config=test_config,
            detector=mock_detector,
            normalizer=normalizer
        )
        
        frame = service.load_image(test_config.image_path)
        assert frame is not None
        assert isinstance(frame, np.ndarray)
    
    def test_load_image_not_found(self, test_config, mock_detector, normalizer):
        """Test error when image not found."""
        service = PlateCaptureService(
            config=test_config,
            detector=mock_detector,
            normalizer=normalizer
        )
        
        with pytest.raises(PlateCaptureError, match="Image not found"):
            service.load_image(Path("nonexistent.jpg"))
    
    def test_detect_and_recognize_success(self, test_config, mock_detector, normalizer):
        """Test successful detection and recognition."""
        service = PlateCaptureService(
            config=test_config,
            detector=mock_detector,
            normalizer=normalizer
        )
        
        frame = np.zeros((480, 640, 3), dtype=np.uint8)
        text, annotated, bboxes = service.detect_and_recognize(frame)
        
        assert text == "51G-39466"
        assert len(bboxes) == 1
        assert annotated is not None
    
    def test_detect_and_recognize_no_plate(self, test_config, normalizer):
        """Test detection when no plate found."""
        detector = Mock()
        detector.detect_frame.return_value = ([], [])
        
        service = PlateCaptureService(
            config=test_config,
            detector=detector,
            normalizer=normalizer
        )
        
        frame = np.zeros((480, 640, 3), dtype=np.uint8)
        
        with pytest.raises(DetectionError, match="No license plate detected"):
            service.detect_and_recognize(frame)
    
    def test_detect_and_recognize_ocr_failed(self, test_config, normalizer):
        """Test detection when OCR fails."""
        detector = Mock()
        detector.detect_frame.return_value = (
            [[100, 100, 200, 150]],
            ["N/A"]
        )
        
        service = PlateCaptureService(
            config=test_config,
            detector=detector,
            normalizer=normalizer
        )
        
        frame = np.zeros((480, 640, 3), dtype=np.uint8)
        
        with pytest.raises(DetectionError, match="OCR failed"):
            service.detect_and_recognize(frame)
    
    def test_process_and_checkin_dry_run(self, test_config, mock_detector, normalizer):
        """Test complete process in dry-run mode."""
        service = PlateCaptureService(
            config=test_config,
            detector=mock_detector,
            normalizer=normalizer
        )
        
        frame = np.zeros((480, 640, 3), dtype=np.uint8)
        result = service.process_and_checkin(frame)
        
        assert result["detection_success"] is True
        assert result["checkin_success"] is True
        assert result["raw_text"] == "51G-39466"
        assert result["normalized_plate"] == "51G-39466"
        assert result["api_response"] is None  # Dry run
    
    def test_process_and_checkin_with_api(
        self,
        test_config,
        mock_detector,
        normalizer,
        mock_api_response_success
    ):
        """Test complete process with API call."""
        # Configure non-dry-run mode
        test_config.dry_run = False
        
        # Mock API client
        mock_client = Mock()
        mock_client.checkin_vehicle.return_value = mock_api_response_success
        
        service = PlateCaptureService(
            config=test_config,
            detector=mock_detector,
            normalizer=normalizer,
            api_client=mock_client
        )
        
        frame = np.zeros((480, 640, 3), dtype=np.uint8)
        result = service.process_and_checkin(frame)
        
        assert result["detection_success"] is True
        assert result["checkin_success"] is True
        assert result["api_response"] == mock_api_response_success
        
        # Verify API was called with normalized plate
        mock_client.checkin_vehicle.assert_called_once_with("51G-39466", "car")
    
    def test_process_saves_images(self, test_config, mock_detector, normalizer):
        """Test that images are saved to output directory."""
        service = PlateCaptureService(
            config=test_config,
            detector=mock_detector,
            normalizer=normalizer
        )
        
        frame = np.zeros((480, 640, 3), dtype=np.uint8)
        service.process_and_checkin(frame)
        
        # Check output directory has files
        output_files = list(test_config.output_dir.glob("*.jpg"))
        assert len(output_files) > 0
    
    def test_run_image_mode(self, test_config, mock_detector, normalizer):
        """Test run() method in image mode."""
        service = PlateCaptureService(
            config=test_config,
            detector=mock_detector,
            normalizer=normalizer
        )
        
        result = service.run()
        
        assert result["detection_success"] is True
        assert result["normalized_plate"] == "51G-39466"


class TestEndToEndWorkflow:
    """End-to-end integration tests."""
    
    def test_full_workflow_dry_run(self, test_config, mock_detector, normalizer):
        """Test complete workflow from image to result."""
        service = PlateCaptureService(
            config=test_config,
            detector=mock_detector,
            normalizer=normalizer
        )
        
        # Execute complete workflow
        result = service.run()
        
        # Verify all steps completed
        assert result["raw_text"] is not None
        assert result["normalized_plate"] is not None
        assert result["detection_success"] is True
        assert result["checkin_success"] is True
        assert result["annotated_frame"] is not None
        
        # Verify output files created
        output_files = list(test_config.output_dir.glob("*.jpg"))
        assert len(output_files) >= 1
    
    @pytest.mark.parametrize("raw_text,expected_normalized", [
        ("51G-39466", "51G-39466"),
        ("90-B2 452.30", "90-8245230"),
        ("O1I-Z5B8", "011-2588"),
    ])
    def test_normalization_variants(
        self,
        test_config,
        normalizer,
        raw_text,
        expected_normalized
    ):
        """Test various plate formats are normalized correctly."""
        detector = Mock()
        detector.detect_frame.return_value = (
            [[100, 100, 200, 150]],
            [raw_text]
        )
        
        service = PlateCaptureService(
            config=test_config,
            detector=detector,
            normalizer=normalizer
        )
        
        frame = np.zeros((480, 640, 3), dtype=np.uint8)
        result = service.process_and_checkin(frame)
        
        assert result["normalized_plate"] == expected_normalized
