"""Backend API client for parking system integration.

This module handles all HTTP communication with the backend API,
including authentication, session management, and retry logic.
"""
import logging
import time
from typing import Dict, Optional, Any
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from config.settings import APIConfig


logger = logging.getLogger(__name__)


class APIClientError(Exception):
    """Base exception for API client errors."""
    pass


class AuthenticationError(APIClientError):
    """Raised when authentication fails."""
    pass


class CheckinError(APIClientError):
    """Raised when check-in operation fails."""
    pass


class ParkingAPIClient:
    """
    Client for interacting with parking system backend API.
    
    Handles authentication, session management, and API calls with
    automatic retry logic for transient failures.
    """
    
    def __init__(self, config: APIConfig):
        """
        Initialize API client.
        
        Args:
            config: API configuration settings
        """
        self.config = config
        self.session = self._create_session()
        self._authenticated = False
        
    def _create_session(self) -> requests.Session:
        """
        Create requests session with retry logic.
        
        Returns:
            Configured requests session
        """
        session = requests.Session()
        
        # Configure retry strategy
        retry_strategy = Retry(
            total=self.config.max_retries,
            backoff_factor=self.config.retry_delay,
            status_forcelist=[429, 500, 502, 503, 504],
            allowed_methods=["HEAD", "GET", "POST", "PUT", "DELETE", "OPTIONS", "TRACE"]
        )
        
        adapter = HTTPAdapter(max_retries=retry_strategy)
        session.mount("http://", adapter)
        session.mount("https://", adapter)
        
        return session
    
    def login(self, username: str, password: str) -> None:
        """
        Authenticate with backend API.
        
        Args:
            username: Employee username
            password: Employee password
            
        Raises:
            AuthenticationError: If login fails
            
        Example:
            >>> client = ParkingAPIClient(config)
            >>> client.login("ninh1", "ninh1")
        """
        url = f"{self.config.backend_base}{self.config.login_endpoint}"
        payload = {
            "username": username,
            "password": password
        }
        
        try:
            logger.info(f"Attempting login for user: {username}")
            response = self.session.post(
                url,
                json=payload,
                timeout=self.config.timeout
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success"):
                    self._authenticated = True
                    logger.info("Login successful")
                    return
            
            # Login failed
            error_msg = "Login failed"
            try:
                error_detail = response.json().get("error", "Unknown error")
                error_msg = f"{error_msg}: {error_detail}"
            except Exception:
                error_msg = f"{error_msg}: HTTP {response.status_code}"
            
            logger.error(error_msg)
            raise AuthenticationError(error_msg)
            
        except requests.RequestException as e:
            error_msg = f"Network error during login: {str(e)}"
            logger.error(error_msg)
            raise AuthenticationError(error_msg) from e
    
    def checkin_vehicle(
        self,
        license_plate: str,
        vehicle_type: str = "car"
    ) -> Dict[str, Any]:
        """
        Check in a vehicle to the parking system.
        
        Args:
            license_plate: Normalized license plate string
            vehicle_type: Type of vehicle ("car" or "bike")
            
        Returns:
            Response data from backend including ticket information
            
        Raises:
            CheckinError: If check-in fails
            AuthenticationError: If not authenticated
            
        Example:
            >>> client = ParkingAPIClient(config)
            >>> client.login("ninh1", "ninh1")
            >>> ticket = client.checkin_vehicle("51G-39466", "car")
            >>> print(ticket["ticket"]["session_id"])
            123
        """
        if not self._authenticated:
            raise AuthenticationError("Not authenticated. Call login() first.")
        
        if vehicle_type not in ("car", "bike"):
            raise ValueError("vehicle_type must be 'car' or 'bike'")
        
        url = f"{self.config.backend_base}{self.config.checkin_endpoint}"
        payload = {
            "license_plate": license_plate,
            "vehicle_type": vehicle_type
        }
        
        try:
            logger.info(f"Checking in vehicle: {license_plate} ({vehicle_type})")
            response = self.session.post(
                url,
                json=payload,
                timeout=self.config.timeout
            )
            
            data = response.json()
            
            if response.status_code == 200 and data.get("success"):
                logger.info(
                    f"Check-in successful. Session ID: {data.get('ticket', {}).get('session_id')}"
                )
                return data
            
            # Check-in failed
            error_msg = data.get("error", "Unknown error")
            logger.error(f"Check-in failed: {error_msg}")
            raise CheckinError(f"Check-in failed: {error_msg}")
            
        except requests.RequestException as e:
            error_msg = f"Network error during check-in: {str(e)}"
            logger.error(error_msg)
            raise CheckinError(error_msg) from e
    
    def checkout_vehicle(self, session_id: int) -> Dict[str, Any]:
        """
        Check out a vehicle from the parking system.
        
        Args:
            session_id: Parking session ID
            
        Returns:
            Response data from backend including payment information
            
        Raises:
            CheckinError: If checkout fails
            AuthenticationError: If not authenticated
        """
        if not self._authenticated:
            raise AuthenticationError("Not authenticated. Call login() first.")
        
        # Get checkout info first
        url = f"{self.config.backend_base}{self.config.checkout_endpoint}/{session_id}"
        
        try:
            logger.info(f"Getting checkout info for session: {session_id}")
            response = self.session.get(
                url,
                timeout=self.config.timeout
            )
            
            if response.status_code != 200:
                raise CheckinError(f"Failed to get checkout info: HTTP {response.status_code}")
            
            return response.json()
            
        except requests.RequestException as e:
            error_msg = f"Network error during checkout: {str(e)}"
            logger.error(error_msg)
            raise CheckinError(error_msg) from e
    
    def close(self) -> None:
        """Close the session and cleanup resources."""
        if self.session:
            self.session.close()
            logger.debug("API session closed")
    
    def __enter__(self):
        """Context manager entry."""
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit."""
        self.close()
