"""Unit tests for API client."""
import pytest
import responses
from requests.exceptions import RequestException

from config.settings import APIConfig
from services.api_client import (
    ParkingAPIClient,
    AuthenticationError,
    CheckinError
)


@pytest.fixture
def api_config():
    """Create test API configuration."""
    return APIConfig(
        backend_base="http://localhost:8000",
        timeout=5,
        max_retries=2
    )


@pytest.fixture
def client(api_config):
    """Create API client instance."""
    return ParkingAPIClient(api_config)


class TestParkingAPIClientInit:
    """Test client initialization."""
    
    def test_client_creation(self, client):
        """Test client can be created."""
        assert client is not None
        assert client._authenticated is False
    
    def test_client_session_created(self, client):
        """Test session is created."""
        assert client.session is not None


class TestParkingAPIClientLogin:
    """Test authentication."""
    
    @responses.activate
    def test_login_success(self, client, api_config):
        """Test successful login."""
        responses.add(
            responses.POST,
            f"{api_config.backend_base}{api_config.login_endpoint}",
            json={"success": True, "user": {"username": "test"}},
            status=200
        )
        
        client.login("test", "password")
        assert client._authenticated is True
    
    @responses.activate
    def test_login_failure_wrong_credentials(self, client, api_config):
        """Test login with wrong credentials."""
        responses.add(
            responses.POST,
            f"{api_config.backend_base}{api_config.login_endpoint}",
            json={"success": False, "error": "Invalid credentials"},
            status=401
        )
        
        with pytest.raises(AuthenticationError, match="Invalid credentials"):
            client.login("test", "wrong")
        
        assert client._authenticated is False
    
    @responses.activate
    def test_login_network_error(self, client, api_config):
        """Test login with network error."""
        responses.add(
            responses.POST,
            f"{api_config.backend_base}{api_config.login_endpoint}",
            body=RequestException("Connection failed")
        )
        
        with pytest.raises(AuthenticationError, match="Network error"):
            client.login("test", "password")


class TestParkingAPIClientCheckin:
    """Test check-in operations."""
    
    @responses.activate
    def test_checkin_success(self, client, api_config):
        """Test successful check-in."""
        # Login first
        responses.add(
            responses.POST,
            f"{api_config.backend_base}{api_config.login_endpoint}",
            json={"success": True},
            status=200
        )
        client.login("test", "password")
        
        # Check-in
        responses.add(
            responses.POST,
            f"{api_config.backend_base}{api_config.checkin_endpoint}",
            json={
                "success": True,
                "ticket": {
                    "session_id": 123,
                    "license_plate": "51G-39466",
                    "time_in": "2025-12-05T10:30:00"
                }
            },
            status=200
        )
        
        result = client.checkin_vehicle("51G-39466", "car")
        
        assert result["success"] is True
        assert result["ticket"]["session_id"] == 123
        assert result["ticket"]["license_plate"] == "51G-39466"
    
    def test_checkin_not_authenticated(self, client):
        """Test check-in without authentication."""
        with pytest.raises(AuthenticationError, match="Not authenticated"):
            client.checkin_vehicle("51G-39466", "car")
    
    @responses.activate
    def test_checkin_invalid_vehicle_type(self, client, api_config):
        """Test check-in with invalid vehicle type."""
        responses.add(
            responses.POST,
            f"{api_config.backend_base}{api_config.login_endpoint}",
            json={"success": True},
            status=200
        )
        client.login("test", "password")
        
        with pytest.raises(ValueError, match="vehicle_type must be"):
            client.checkin_vehicle("51G-39466", "invalid")
    
    @responses.activate
    def test_checkin_parking_full(self, client, api_config):
        """Test check-in when parking is full."""
        responses.add(
            responses.POST,
            f"{api_config.backend_base}{api_config.login_endpoint}",
            json={"success": True},
            status=200
        )
        client.login("test", "password")
        
        responses.add(
            responses.POST,
            f"{api_config.backend_base}{api_config.checkin_endpoint}",
            json={
                "success": False,
                "error": "Parking lot is full"
            },
            status=400
        )
        
        with pytest.raises(CheckinError, match="Parking lot is full"):
            client.checkin_vehicle("51G-39466", "car")
    
    @responses.activate
    def test_checkin_network_error(self, client, api_config):
        """Test check-in with network error."""
        responses.add(
            responses.POST,
            f"{api_config.backend_base}{api_config.login_endpoint}",
            json={"success": True},
            status=200
        )
        client.login("test", "password")
        
        responses.add(
            responses.POST,
            f"{api_config.backend_base}{api_config.checkin_endpoint}",
            body=RequestException("Connection timeout")
        )
        
        with pytest.raises(CheckinError, match="Network error"):
            client.checkin_vehicle("51G-39466", "car")


class TestParkingAPIClientContextManager:
    """Test context manager functionality."""
    
    def test_context_manager(self, api_config):
        """Test client can be used as context manager."""
        with ParkingAPIClient(api_config) as client:
            assert client is not None
            assert client.session is not None
        
        # Session should be closed after exiting context
        # (we can't easily test this without mocking)
