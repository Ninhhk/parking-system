"""
License Plate Capture and Check-in Application.

This script provides a command-line interface for capturing license plates
from camera or image, detecting and recognizing the text, and checking in
vehicles to the parking system via backend API.

Usage:
    # Image mode (default)
    python plate_capture.py
    
    # Camera mode
    MODE=camera python plate_capture.py
    
    # Production mode (POST to backend)
    DRY_RUN=false EMPLOYEE_USER=user EMPLOYEE_PASS=pass python plate_capture.py
"""
import sys
import logging
from pathlib import Path

# Optional: load .env if present
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from config import AppConfig
from services import PlateNormalizer, ParkingAPIClient, PlateCaptureService
from detections.licence_plate_detection import LicencePlateDetection


def setup_logging(log_level: str) -> None:
    """
    Configure logging for the application.
    
    Args:
        log_level: Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
    """
    logging.basicConfig(
        level=getattr(logging, log_level),
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )


def main() -> int:
    """
    Main entry point for plate capture application.
    
    Returns:
        Exit code (0 for success, 1 for failure)
    """
    try:
        # Load configuration from environment
        config = AppConfig.from_env()
        setup_logging(config.log_level)
        logger = logging.getLogger(__name__)
        
        logger.info("="*60)
        logger.info("License Plate Capture & Check-in System")
        logger.info("="*60)
        logger.info(f"Mode: {config.mode.upper()}")
        logger.info(f"Dry Run: {config.dry_run}")
        logger.info(f"Backend: {config.api.backend_base}")
        
        # Initialize detector
        logger.info("Initializing license plate detector...")
        detector = LicencePlateDetection(str(config.model.plate_model_path))
        
        # Initialize normalizer
        normalizer = PlateNormalizer()
        
        # Initialize API client (if not dry-run)
        api_client = None
        if not config.dry_run:
            if not config.employee_username or not config.employee_password:
                logger.error("EMPLOYEE_USER and EMPLOYEE_PASS required for non-dry-run mode")
                return 1
            
            logger.info("Initializing API client...")
            api_client = ParkingAPIClient(config.api)
            
            logger.info(f"Logging in as: {config.employee_username}")
            api_client.login(config.employee_username, config.employee_password)
            logger.info("Authentication successful")
        
        # Create service orchestrator
        service = PlateCaptureService(
            config=config,
            detector=detector,
            normalizer=normalizer,
            api_client=api_client
        )
        
        # Execute workflow
        logger.info("-"*60)
        logger.info("Starting plate capture workflow...")
        result = service.run()
        
        # Display results
        logger.info("="*60)
        logger.info("RESULTS")
        logger.info("="*60)
        logger.info(f"Raw OCR Text: {result.get('raw_text', 'N/A')}")
        logger.info(f"Normalized Plate: {result.get('normalized_plate', 'N/A')}")
        logger.info(f"Detection: {'SUCCESS' if result.get('detection_success') else 'FAILED'}")
        logger.info(f"Check-in: {'SUCCESS' if result.get('checkin_success') else 'FAILED'}")
        
        if result.get('api_response'):
            ticket = result['api_response'].get('ticket', {})
            logger.info(f"Session ID: {ticket.get('session_id')}")
            logger.info(f"Parking Lot: {ticket.get('lot_name')}")
            logger.info(f"Time In: {ticket.get('time_in')}")
        
        logger.info("="*60)
        logger.info("Plate capture completed successfully")
        
        # Cleanup
        if api_client:
            api_client.close()
        
        return 0
        
    except KeyboardInterrupt:
        logger.warning("Operation cancelled by user")
        return 1
        
    except Exception as e:
        logger.exception(f"Fatal error: {str(e)}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
