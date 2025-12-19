"""Services module."""
from .plate_normalizer import PlateNormalizer
from .api_client import ParkingAPIClient

__all__ = ["PlateNormalizer", "ParkingAPIClient", "PlateCaptureService"]


def __getattr__(name):
    """Lazy import for heavy dependencies."""
    if name == "PlateCaptureService":
        from .plate_capture_service import PlateCaptureService
        return PlateCaptureService
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
