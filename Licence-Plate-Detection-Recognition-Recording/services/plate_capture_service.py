"""Plate capture service orchestration.

This module coordinates detection, normalization, and API integration
to provide a high-level interface for license plate capture and check-in.
"""
import logging
from pathlib import Path
from typing import Dict, Any, Optional, Tuple, TYPE_CHECKING
import cv2
import numpy as np

from config.settings import AppConfig
from services.plate_normalizer import PlateNormalizer
from services.api_client import ParkingAPIClient, APIClientError

# Type hints for detection (lazy import at runtime)
if TYPE_CHECKING:
    from detections.licence_plate_detection import LicencePlateDetection


logger = logging.getLogger(__name__)


class PlateCaptureError(Exception):
    """Base exception for plate capture errors."""
    pass


class DetectionError(PlateCaptureError):
    """Raised when plate detection fails."""
    pass


class PlateCaptureService:
    """
    High-level service for license plate capture and check-in workflow.
    
    Orchestrates:
    1. Frame acquisition (camera or image)
    2. Plate detection and OCR
    3. Normalization
    4. Backend API check-in
    5. Result persistence
    """
    
    def __init__(
        self,
        config: AppConfig,
        detector: "LicencePlateDetection",
        normalizer: PlateNormalizer,
        api_client: Optional[ParkingAPIClient] = None
    ):
        """
        Initialize plate capture service.
        
        Args:
            config: Application configuration
            detector: License plate detector instance
            normalizer: Plate normalizer instance
            api_client: Optional API client (if None, dry-run mode)
        """
        self.config = config
        self.detector = detector
        self.normalizer = normalizer
        self.api_client = api_client
        
    def capture_from_camera(self) -> np.ndarray:
        """
        Capture single frame from camera.
        
        Returns:
            Captured frame as numpy array
            
        Raises:
            PlateCaptureError: If camera capture fails
        """
        logger.info(f"Opening camera {self.config.camera.camera_index}")
        cap = cv2.VideoCapture(self.config.camera.camera_index)
        
        if not cap.isOpened():
            raise PlateCaptureError(
                f"Failed to open camera {self.config.camera.camera_index}"
            )
        
        try:
            # Set resolution if configured
            if self.config.camera.frame_width:
                cap.set(cv2.CAP_PROP_FRAME_WIDTH, self.config.camera.frame_width)
            if self.config.camera.frame_height:
                cap.set(cv2.CAP_PROP_FRAME_HEIGHT, self.config.camera.frame_height)
            
            # Capture frame
            ret, frame = cap.read()
            if not ret or frame is None:
                raise PlateCaptureError("Failed to capture frame from camera")
            
            logger.info(f"Captured frame: {frame.shape}")
            return frame
            
        finally:
            cap.release()
    
    def load_image(self, image_path: Path) -> np.ndarray:
        """
        Load image from file.
        
        Args:
            image_path: Path to image file
            
        Returns:
            Loaded image as numpy array
            
        Raises:
            PlateCaptureError: If image loading fails
        """
        logger.info(f"Loading image from: {image_path}")
        
        if not image_path.exists():
            raise PlateCaptureError(f"Image not found: {image_path}")
        
        frame = cv2.imread(str(image_path))
        if frame is None:
            raise PlateCaptureError(f"Failed to load image: {image_path}")
        
        logger.info(f"Loaded image: {frame.shape}")
        return frame
    
    def detect_and_recognize(
        self,
        frame: np.ndarray
    ) -> Tuple[str, np.ndarray, list]:
        """
        Detect and recognize license plate in frame.
        
        Args:
            frame: Input image frame
            
        Returns:
            Tuple of (detected_text, annotated_frame, bbox_list)
            
        Raises:
            DetectionError: If no plate detected or OCR fails
        """
        logger.info("Running license plate detection")
        bbox_list, text_list = self.detector.detect_frame(frame)
        
        if not text_list:
            raise DetectionError("No license plate detected in frame")
        
        if not text_list[0] or text_list[0] == "N/A":
            raise DetectionError("OCR failed to recognize text")
        
        detected_text = text_list[0]
        logger.info(f"Raw OCR text: {detected_text}")
        
        # Draw bounding boxes
        annotated_frame = frame.copy()
        for bbox, text in zip(bbox_list, text_list):
            x1, y1, x2, y2 = map(int, bbox)
            cv2.rectangle(annotated_frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
            cv2.putText(
                annotated_frame,
                text,
                (x1, y1 - 10),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.9,
                (255, 255, 0),
                2
            )
        
        return detected_text, annotated_frame, bbox_list
    
    def process_and_checkin(
        self,
        frame: np.ndarray,
        vehicle_type: str = "car"
    ) -> Dict[str, Any]:
        """
        Complete workflow: detect, normalize, and check-in vehicle.
        
        Args:
            frame: Input image frame
            vehicle_type: Type of vehicle ("car" or "bike")
            
        Returns:
            Dictionary containing:
                - raw_text: Original OCR output
                - normalized_plate: Normalized license plate
                - detection_success: Whether detection succeeded
                - checkin_success: Whether check-in succeeded (if not dry-run)
                - api_response: Backend response (if not dry-run)
                - annotated_frame: Frame with bounding boxes
                
        Raises:
            PlateCaptureError: If process fails critically
        """
        result = {
            "raw_text": None,
            "normalized_plate": None,
            "detection_success": False,
            "checkin_success": False,
            "api_response": None,
            "annotated_frame": None,
            "error": None
        }
        
        try:
            # Step 1: Detect and recognize
            raw_text, annotated_frame, bbox_list = self.detect_and_recognize(frame)
            result["raw_text"] = raw_text
            result["annotated_frame"] = annotated_frame
            result["detection_success"] = True
            
            # Step 2: Normalize plate
            normalized_plate = self.normalizer.sanitize(raw_text)
            result["normalized_plate"] = normalized_plate
            logger.info(f"Normalized plate: {normalized_plate}")
            
            if not self.normalizer.is_valid(normalized_plate):
                raise DetectionError(f"Invalid normalized plate: {normalized_plate}")
            
            # Step 3: Check-in (if not dry-run)
            if self.config.dry_run:
                logger.info("DRY RUN mode - skipping API check-in")
                result["checkin_success"] = True
            else:
                if not self.api_client:
                    raise PlateCaptureError("API client required for non-dry-run mode")
                
                logger.info(f"Checking in vehicle: {normalized_plate}")
                api_response = self.api_client.checkin_vehicle(
                    normalized_plate,
                    vehicle_type
                )
                result["api_response"] = api_response
                result["checkin_success"] = True
                logger.info("Check-in successful")
            
            # Step 4: Save output if configured
            if self.config.save_images:
                self._save_result(normalized_plate, annotated_frame, bbox_list, frame)
            
            return result
            
        except DetectionError as e:
            logger.error(f"Detection error: {str(e)}")
            result["error"] = str(e)
            raise
            
        except APIClientError as e:
            logger.error(f"API error: {str(e)}")
            result["error"] = str(e)
            result["detection_success"] = True  # Detection worked
            raise PlateCaptureError(f"Check-in failed: {str(e)}") from e
            
        except Exception as e:
            logger.exception(f"Unexpected error: {str(e)}")
            result["error"] = str(e)
            raise PlateCaptureError(f"Process failed: {str(e)}") from e
    
    def _save_result(
        self,
        plate: str,
        annotated_frame: np.ndarray,
        bbox_list: list,
        original_frame: np.ndarray
    ) -> None:
        """
        Save detection results to disk.
        
        Args:
            plate: Normalized license plate
            annotated_frame: Frame with bounding boxes
            bbox_list: List of bounding boxes
            original_frame: Original frame for cropping
        """
        import datetime
        
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # Save annotated frame
        output_path = self.config.output_dir / f"{plate}_{timestamp}_annotated.jpg"
        cv2.imwrite(str(output_path), annotated_frame)
        logger.info(f"Saved annotated frame: {output_path}")
        
        # Save cropped plate region if detected
        if bbox_list:
            x1, y1, x2, y2 = map(int, bbox_list[0])
            cropped = original_frame[y1:y2, x1:x2]
            crop_path = self.config.output_dir / f"{plate}_{timestamp}_crop.jpg"
            cv2.imwrite(str(crop_path), cropped)
            logger.info(f"Saved cropped plate: {crop_path}")
    
    def run(self) -> Dict[str, Any]:
        """
        Execute complete capture workflow based on configuration.
        
        Returns:
            Result dictionary from process_and_checkin
            
        Raises:
            PlateCaptureError: If workflow fails
        """
        # Acquire frame
        if self.config.mode == "camera":
            frame = self.capture_from_camera()
        else:
            if not self.config.image_path:
                raise PlateCaptureError("Image path required for image mode")
            frame = self.load_image(self.config.image_path)
        
        # Process
        return self.process_and_checkin(frame)
