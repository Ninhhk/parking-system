"""Unit tests for configuration module."""
import os
import pytest
from pathlib import Path
from config.settings import AppConfig, ModelConfig, APIConfig, CameraConfig


class TestModelConfig:
    """Test ModelConfig dataclass."""
    
    def test_model_config_defaults(self, tmp_path):
        """Test default model configuration."""
        # Create dummy model file
        model_path = tmp_path / "models" / "best.pt"
        model_path.parent.mkdir(parents=True)
        model_path.touch()
        
        config = ModelConfig(plate_model_path=model_path)
        assert config.plate_model_path == model_path
        assert config.confidence_threshold == 0.7
    
    def test_model_config_missing_file(self):
        """Test validation when model file doesn't exist."""
        with pytest.raises(FileNotFoundError):
            ModelConfig(plate_model_path=Path("nonexistent/model.pt"))
    
    def test_model_config_invalid_confidence(self, tmp_path):
        """Test validation of confidence threshold."""
        model_path = tmp_path / "model.pt"
        model_path.touch()
        
        with pytest.raises(ValueError, match="Confidence threshold"):
            ModelConfig(plate_model_path=model_path, confidence_threshold=1.5)
        
        with pytest.raises(ValueError, match="Confidence threshold"):
            ModelConfig(plate_model_path=model_path, confidence_threshold=0)


class TestAPIConfig:
    """Test APIConfig dataclass."""
    
    def test_api_config_defaults(self):
        """Test default API configuration."""
        config = APIConfig()
        assert config.backend_base == "http://localhost:8000"
        assert config.login_endpoint == "/api/auth/login"
        assert config.checkin_endpoint == "/api/employee/parking/entry"
        assert config.timeout == 30
        assert config.max_retries == 3
    
    def test_api_config_invalid_url(self):
        """Test validation of backend URL."""
        with pytest.raises(ValueError, match="http://"):
            APIConfig(backend_base="invalid-url")
    
    def test_api_config_https_url(self):
        """Test HTTPS URL is accepted."""
        config = APIConfig(backend_base="https://api.example.com")
        assert config.backend_base == "https://api.example.com"
    
    def test_api_config_invalid_timeout(self):
        """Test validation of timeout."""
        with pytest.raises(ValueError, match="Timeout"):
            APIConfig(timeout=-1)
    
    def test_api_config_invalid_retries(self):
        """Test validation of max retries."""
        with pytest.raises(ValueError, match="Max retries"):
            APIConfig(max_retries=-1)


class TestCameraConfig:
    """Test CameraConfig dataclass."""
    
    def test_camera_config_defaults(self):
        """Test default camera configuration."""
        config = CameraConfig()
        assert config.camera_index == 0
        assert config.frame_width is None
        assert config.frame_height is None
    
    def test_camera_config_invalid_index(self):
        """Test validation of camera index."""
        with pytest.raises(ValueError, match="Camera index"):
            CameraConfig(camera_index=-1)


class TestAppConfig:
    """Test AppConfig dataclass."""
    
    def test_app_config_defaults(self, tmp_path):
        """Test default app configuration."""
        # Create dummy model
        model_path = tmp_path / "models" / "best.pt"
        model_path.parent.mkdir(parents=True)
        model_path.touch()
        
        # Create dummy image
        image_path = tmp_path / "test.jpg"
        image_path.touch()
        
        config = AppConfig(
            model=ModelConfig(plate_model_path=model_path),
            image_path=image_path
        )
        
        assert config.mode == "image"
        assert config.dry_run is True
        assert config.log_level == "INFO"
    
    def test_app_config_invalid_mode(self, tmp_path):
        """Test validation of mode."""
        model_path = tmp_path / "model.pt"
        model_path.touch()
        image_path = tmp_path / "test.jpg"
        image_path.touch()
        
        with pytest.raises(ValueError, match="Mode must be"):
            AppConfig(
                model=ModelConfig(plate_model_path=model_path),
                mode="invalid",
                image_path=image_path
            )
    
    def test_app_config_image_mode_requires_path(self, tmp_path):
        """Test image mode requires image_path."""
        model_path = tmp_path / "model.pt"
        model_path.touch()
        
        with pytest.raises(ValueError, match="Image path required"):
            AppConfig(
                model=ModelConfig(plate_model_path=model_path),
                mode="image",
                image_path=None
            )
    
    def test_app_config_invalid_log_level(self, tmp_path):
        """Test validation of log level."""
        model_path = tmp_path / "model.pt"
        model_path.touch()
        image_path = tmp_path / "test.jpg"
        image_path.touch()
        
        with pytest.raises(ValueError, match="Invalid log level"):
            AppConfig(
                model=ModelConfig(plate_model_path=model_path),
                image_path=image_path,
                log_level="INVALID"
            )
    
    def test_app_config_creates_output_dir(self, tmp_path):
        """Test output directory creation."""
        model_path = tmp_path / "model.pt"
        model_path.touch()
        image_path = tmp_path / "test.jpg"
        image_path.touch()
        output_dir = tmp_path / "outputs"
        
        config = AppConfig(
            model=ModelConfig(plate_model_path=model_path),
            image_path=image_path,
            output_dir=output_dir,
            save_images=True
        )
        
        assert output_dir.exists()


class TestAppConfigFromEnv:
    """Test loading configuration from environment variables."""
    
    def test_from_env_defaults(self, tmp_path, monkeypatch):
        """Test loading with default values."""
        # Setup
        model_path = tmp_path / "models" / "best.pt"
        model_path.parent.mkdir(parents=True)
        model_path.touch()
        image_path = tmp_path / "test.jpg"
        image_path.touch()
        
        monkeypatch.setenv("PLATE_MODEL_PATH", str(model_path))
        monkeypatch.setenv("IMAGE_PATH", str(image_path))
        
        config = AppConfig.from_env()
        
        assert config.mode == "image"
        assert config.dry_run is True
        assert config.api.backend_base == "http://localhost:8000"
        assert config.camera.camera_index == 0
    
    def test_from_env_custom_values(self, tmp_path, monkeypatch):
        """Test loading with custom environment values."""
        model_path = tmp_path / "models" / "best.pt"
        model_path.parent.mkdir(parents=True)
        model_path.touch()
        image_path = tmp_path / "test.jpg"
        image_path.touch()
        
        monkeypatch.setenv("PLATE_MODEL_PATH", str(model_path))
        monkeypatch.setenv("MODE", "image")
        monkeypatch.setenv("IMAGE_PATH", str(image_path))
        monkeypatch.setenv("BACKEND_BASE", "https://api.example.com")
        monkeypatch.setenv("CAM_INDEX", "1")
        monkeypatch.setenv("DRY_RUN", "false")
        monkeypatch.setenv("LOG_LEVEL", "DEBUG")
        monkeypatch.setenv("EMPLOYEE_USER", "test_user")
        monkeypatch.setenv("EMPLOYEE_PASS", "test_pass")
        
        config = AppConfig.from_env()
        
        assert config.mode == "image"
        assert config.dry_run is False
        assert config.api.backend_base == "https://api.example.com"
        assert config.camera.camera_index == 1
        assert config.log_level == "DEBUG"
        assert config.employee_username == "test_user"
        assert config.employee_password == "test_pass"
    
    def test_from_env_dry_run_variations(self, tmp_path, monkeypatch):
        """Test various dry_run values."""
        model_path = tmp_path / "models" / "best.pt"
        model_path.parent.mkdir(parents=True)
        model_path.touch()
        image_path = tmp_path / "test.jpg"
        image_path.touch()
        
        monkeypatch.setenv("PLATE_MODEL_PATH", str(model_path))
        monkeypatch.setenv("IMAGE_PATH", str(image_path))
        
        # Test "false"
        monkeypatch.setenv("DRY_RUN", "false")
        config = AppConfig.from_env()
        assert config.dry_run is False
        
        # Test "0"
        monkeypatch.setenv("DRY_RUN", "0")
        config = AppConfig.from_env()
        assert config.dry_run is False
        
        # Test "true"
        monkeypatch.setenv("DRY_RUN", "true")
        config = AppConfig.from_env()
        assert config.dry_run is True
