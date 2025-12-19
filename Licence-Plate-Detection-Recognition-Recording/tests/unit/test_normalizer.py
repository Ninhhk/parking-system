"""Unit tests for PlateNormalizer service."""
import pytest
from services.plate_normalizer import PlateNormalizer


class TestPlateNormalizerSanitize:
    """Test sanitization logic."""
    
    def test_sanitize_simple_plate(self):
        """Test basic plate sanitization."""
        result = PlateNormalizer.sanitize("51G-394.66")
        assert result == "51G-39466"
    
    def test_sanitize_vietnamese_2line_plate(self):
        """Test Vietnamese 2-line plate format."""
        result = PlateNormalizer.sanitize("90-B2 452.30")
        assert result == "90-8245230"
    
    def test_sanitize_with_ocr_corrections(self):
        """Test OCR confusion corrections."""
        result = PlateNormalizer.sanitize("O1I-Z5B8", apply_ocr_corrections=True)
        assert result == "011-2588"
    
    def test_sanitize_without_ocr_corrections(self):
        """Test sanitization without OCR corrections."""
        result = PlateNormalizer.sanitize("OIZ-SB8", apply_ocr_corrections=False)
        assert result == "OIZ-SB8"
    
    def test_sanitize_removes_spaces(self):
        """Test space removal."""
        result = PlateNormalizer.sanitize("51 G - 394 66")
        assert result == "51G-39466"
    
    def test_sanitize_removes_special_chars(self):
        """Test removal of invalid characters."""
        result = PlateNormalizer.sanitize("51G@394!66#")
        assert result == "51G39466"
    
    def test_sanitize_collapses_hyphens(self):
        """Test multiple hyphen collapsing."""
        result = PlateNormalizer.sanitize("51---G--394--66")
        assert result == "51-G-394-66"
    
    def test_sanitize_trims_hyphens(self):
        """Test leading/trailing hyphen removal."""
        result = PlateNormalizer.sanitize("-51G-39466-")
        assert result == "51G-39466"
    
    def test_sanitize_uppercase_conversion(self):
        """Test uppercase conversion."""
        result = PlateNormalizer.sanitize("51g-39466")
        assert result == "51G-39466"
    
    def test_sanitize_empty_string(self):
        """Test empty string handling."""
        result = PlateNormalizer.sanitize("")
        assert result == ""
    
    def test_sanitize_none_input(self):
        """Test None input handling."""
        result = PlateNormalizer.sanitize(None)
        assert result == ""
    
    def test_sanitize_whitespace_only(self):
        """Test whitespace-only input."""
        result = PlateNormalizer.sanitize("   ")
        assert result == ""
    
    def test_sanitize_all_ocr_corrections(self):
        """Test all OCR correction mappings."""
        # O→0, I→1, Z→2, S→5, B→8
        result = PlateNormalizer.sanitize("OIZSB")
        assert result == "01258"


class TestPlateNormalizerValidation:
    """Test plate validation logic."""
    
    def test_is_valid_correct_plate(self):
        """Test validation of correct plate."""
        assert PlateNormalizer.is_valid("51G-39466") is True
    
    def test_is_valid_alphanumeric(self):
        """Test validation of alphanumeric plate."""
        assert PlateNormalizer.is_valid("ABC123") is True
    
    def test_is_valid_with_hyphen(self):
        """Test validation of plate with hyphen."""
        assert PlateNormalizer.is_valid("90-8245230") is True
    
    def test_is_valid_empty_string(self):
        """Test validation of empty string."""
        assert PlateNormalizer.is_valid("") is False
    
    def test_is_valid_invalid_chars(self):
        """Test validation rejects invalid characters."""
        assert PlateNormalizer.is_valid("51G@394") is False
    
    def test_is_valid_lowercase(self):
        """Test validation rejects lowercase."""
        assert PlateNormalizer.is_valid("51g-394") is False


class TestPlateNormalizerVietnamese:
    """Test Vietnamese 2-line plate formatting."""
    
    def test_format_vietnamese_2line_basic(self):
        """Test basic 2-line formatting."""
        result = PlateNormalizer.format_vietnamese_2line("90-B2", "452.30")
        assert result == "90-8245230"
    
    def test_format_vietnamese_2line_no_hyphen(self):
        """Test 2-line without hyphen."""
        result = PlateNormalizer.format_vietnamese_2line("51G", "394.66")
        assert result == "51G39466"
    
    def test_format_vietnamese_2line_with_spaces(self):
        """Test 2-line with spaces."""
        result = PlateNormalizer.format_vietnamese_2line("90 - B2", "452 . 30")
        assert result == "90-8245230"


class TestPlateNormalizerRealWorld:
    """Test with real-world scenarios."""
    
    def test_backend_compatibility(self):
        """
        Test that Python output matches backend JavaScript logic.
        
        Backend applies: O→0, I→1, Z→2, S→5, B→8
        """
        # Test case: Backend receives "90-B245230"
        python_result = PlateNormalizer.sanitize("90-B2 452.30")
        # Both should produce "90-8245230"
        assert python_result == "90-8245230"
    
    def test_ocr_dirty_output(self):
        """Test handling of noisy OCR output."""
        result = PlateNormalizer.sanitize("5 1 G - 3 9 4 . 6 6")
        assert result == "51G-39466"
    
    def test_ocr_with_dots_and_spaces(self):
        """Test OCR with common artifacts."""
        result = PlateNormalizer.sanitize("90-B2. 452.30")
        assert result == "90-8245230"
