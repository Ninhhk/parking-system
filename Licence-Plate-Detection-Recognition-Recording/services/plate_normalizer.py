"""License plate normalization service.

This module ensures Python normalization matches the backend logic exactly.
All OCR corrections and sanitization rules must be synchronized with
be/utils/licensePlate.js
"""
import re
from typing import Set


class PlateNormalizer:
    """
    Normalizes license plate strings using rules matching the backend.
    
    The normalization process:
    1. Convert to uppercase
    2. Apply OCR corrections (O→0, I→1, Z→2, S→5, B→8)
    3. Remove invalid characters (keep only A-Z, 0-9, -)
    4. Collapse multiple hyphens
    5. Remove leading/trailing hyphens
    """
    
    # Allowed characters in normalized plates
    ALLOWED_CHARS: Set[str] = set("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-")
    
    # OCR corrections matching backend
    OCR_CORRECTIONS = {
        'O': '0',
        'I': '1', 
        'Z': '2',
        'S': '5',
        'B': '8'
    }
    
    def __init__(self):
        """Initialize PlateNormalizer instance."""
        pass
    
    @classmethod
    def sanitize(cls, raw: str, apply_ocr_corrections: bool = True) -> str:
        """
        Sanitize a raw license plate string.
        
        Args:
            raw: Raw license plate string from OCR
            apply_ocr_corrections: Whether to apply OCR corrections (default: True)
        
        Returns:
            Sanitized license plate string matching backend format
            
        Examples:
            >>> PlateNormalizer.sanitize("90-B2 452.30")
            "90-8245230"
            >>> PlateNormalizer.sanitize("51G-394.66")
            "51G-39466"
            >>> PlateNormalizer.sanitize("O1I-Z5B8", apply_ocr_corrections=False)
            "O1I-Z5B8"
            >>> PlateNormalizer.sanitize("O1I-Z5B8", apply_ocr_corrections=True)
            "011-2588"
        """
        if not raw or not isinstance(raw, str):
            return ""
        
        # Step 1: Trim and uppercase
        plate = raw.strip().upper()
        
        # Step 2: Apply OCR corrections
        if apply_ocr_corrections:
            for old_char, new_char in cls.OCR_CORRECTIONS.items():
                plate = plate.replace(old_char, new_char)
        
        # Step 3: Remove invalid characters (keep only A-Z, 0-9, -)
        plate = re.sub(r'[^A-Z0-9-]', '', plate)
        
        # Step 4: Collapse multiple hyphens
        plate = re.sub(r'-+', '-', plate)
        
        # Step 5: Remove leading/trailing hyphens
        plate = plate.strip('-')
        
        return plate
    
    @classmethod
    def is_valid(cls, plate: str) -> bool:
        """
        Check if a plate string is valid after normalization.
        
        Args:
            plate: Normalized license plate string
            
        Returns:
            True if plate is valid, False otherwise
            
        Examples:
            >>> PlateNormalizer.is_valid("51G-39466")
            True
            >>> PlateNormalizer.is_valid("")
            False
            >>> PlateNormalizer.is_valid("ABC")
            True
        """
        if not plate:
            return False
        
        # Check all characters are allowed
        return all(c in cls.ALLOWED_CHARS for c in plate)
    
    @classmethod
    def format_vietnamese_2line(cls, line1: str, line2: str) -> str:
        """
        Format Vietnamese 2-line license plates by joining lines.
        
        Args:
            line1: First line (e.g., "90-B2")
            line2: Second line (e.g., "452.30")
            
        Returns:
            Joined and sanitized plate (e.g., "90-8245230")
            
        Examples:
            >>> PlateNormalizer.format_vietnamese_2line("90-B2", "452.30")
            "90-8245230"
            >>> PlateNormalizer.format_vietnamese_2line("51G", "394.66")
            "51G39466"
        """
        combined = f"{line1}{line2}"
        return cls.sanitize(combined)
    
    # Instance methods (delegate to class methods for convenience)
    def sanitize_instance(self, raw: str, apply_ocr_corrections: bool = True) -> str:
        """
        Instance method wrapper for sanitize.
        Allows calling normalizer.sanitize_instance() on an instance.
        """
        return self.sanitize(raw, apply_ocr_corrections)
    
    def is_valid_instance(self, plate: str) -> bool:
        """
        Instance method wrapper for is_valid.
        Allows calling normalizer.is_valid_instance() on an instance.
        """
        return self.is_valid(plate)

