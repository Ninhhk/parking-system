"""Application configuration settings.

This module provides centralized configuration management using dataclasses.
Configuration can be loaded from environment variables or provided programmatically.
"""
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional


@dataclass
class ModelConfig:
    """Configuration for ML models."""
    
    plate_model_path: Path = Path("models/best.pt")
    confidence_threshold: float = 0.7
    
    def __post_init__(self):
        """Validate model configuration."""
        if not self.plate_model_path.exists():
            raise FileNotFoundError(f"Model not found: {self.plate_model_path}")
        if not 0 < self.confidence_threshold <= 1:
            raise ValueError("Confidence threshold must be between 0 and 1")


@dataclass
class APIConfig:
    """Configuration for backend API."""
    
    backend_base: str = "http://localhost:8000"
    login_endpoint: str = "/api/auth/login"
    checkin_endpoint: str = "/api/employee/parking/entry"
    checkout_endpoint: str = "/api/employee/parking/exit"
    timeout: int = 30
    max_retries: int = 3
    retry_delay: float = 1.0
    
    def __post_init__(self):
        """Validate API configuration."""
        if not self.backend_base.startswith(("http://", "https://")):
            raise ValueError("Backend base URL must start with http:// or https://")
        if self.timeout <= 0:
            raise ValueError("Timeout must be positive")
        if self.max_retries < 0:
            raise ValueError("Max retries cannot be negative")


@dataclass
class CameraConfig:
    """Configuration for camera capture."""
    
    camera_index: int = 0
    frame_width: Optional[int] = None
    frame_height: Optional[int] = None
    
    def __post_init__(self):
        """Validate camera configuration."""
        if self.camera_index < 0:
            raise ValueError("Camera index cannot be negative")


@dataclass
class AppConfig:
    """Main application configuration."""
    
    model: ModelConfig = field(default_factory=ModelConfig)
    api: APIConfig = field(default_factory=APIConfig)
    camera: CameraConfig = field(default_factory=CameraConfig)
    
    # Application settings
    mode: str = "camera"  # "image" or "camera"
    image_path: Optional[Path] = None
    dry_run: bool = True
    output_dir: Path = Path("outputs")
    save_images: bool = True
    
    # Credentials
    employee_username: Optional[str] = None
    employee_password: Optional[str] = None
    
    # Logging
    log_level: str = "INFO"
    
    def __post_init__(self):
        """Validate app configuration."""
        if self.mode not in ("image", "camera"):
            raise ValueError("Mode must be 'image' or 'camera'")
        if self.mode == "image" and not self.image_path:
            raise ValueError("Image path required when mode is 'image'")
        if self.log_level not in ("DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"):
            raise ValueError("Invalid log level")
        
        # Create output directory if needed
        if self.save_images:
            self.output_dir.mkdir(parents=True, exist_ok=True)
    
    @classmethod
    def from_env(cls) -> "AppConfig":
        """
        Load configuration from environment variables.
        
        Environment variables:
            BACKEND_BASE: Backend API base URL
            EMPLOYEE_USER: Employee username
            EMPLOYEE_PASS: Employee password
            CAM_INDEX: Camera index (default: 0)
            MODE: Operation mode - "camera" or "image" (default: image)
            IMAGE_PATH: Path to image file (required if MODE=image)
            DRY_RUN: If "false", will POST to backend (default: true)
            OUTPUT_DIR: Directory for saving outputs (default: outputs)
            LOG_LEVEL: Logging level (default: INFO)
        
        Returns:
            Configured AppConfig instance
            
        Raises:
            ValueError: If required configuration is missing or invalid
        """
        mode = os.getenv("MODE", "camera").lower()
        image_path = os.getenv("IMAGE_PATH")
        
        model_config = ModelConfig(
            plate_model_path=Path(os.getenv("PLATE_MODEL_PATH", "models/best.pt")),
            confidence_threshold=float(os.getenv("CONFIDENCE_THRESHOLD", "0.7"))
        )
        
        api_config = APIConfig(
            backend_base=os.getenv("BACKEND_BASE", "http://localhost:8000"),
            timeout=int(os.getenv("API_TIMEOUT", "30")),
            max_retries=int(os.getenv("API_MAX_RETRIES", "3")),
            retry_delay=float(os.getenv("API_RETRY_DELAY", "1.0"))
        )
        
        camera_config = CameraConfig(
            camera_index=int(os.getenv("CAM_INDEX", "0"))
        )
        
        dry_run_str = os.getenv("DRY_RUN", "true").lower()
        dry_run = dry_run_str not in ("false", "0", "no")
        
        return cls(
            model=model_config,
            api=api_config,
            camera=camera_config,
            mode=mode,
            image_path=Path(image_path) if image_path else None,
            dry_run=dry_run,
            output_dir=Path(os.getenv("OUTPUT_DIR", "outputs")),
            save_images=os.getenv("SAVE_IMAGES", "true").lower() not in ("false", "0", "no"),
            employee_username=os.getenv("EMPLOYEE_USER"),
            employee_password=os.getenv("EMPLOYEE_PASS"),
            log_level=os.getenv("LOG_LEVEL", "INFO").upper()
        )
