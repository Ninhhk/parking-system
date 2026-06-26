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
        """Series letter 'B' must be preserved, not coerced to '8'."""
        result = PlateNormalizer.sanitize("90-B2 452.30")
        assert result == "90-B245230"

    def test_sanitize_preserves_series_letter(self):
        """Regression: position-aware correction keeps the series letter."""
        # 'B' at the series position stays 'B' (was wrongly turned into '8')
        assert PlateNormalizer.sanitize("90B2-45230") == "90B2-45230"
        # 'S' / 'Z' series letters likewise preserved
        assert PlateNormalizer.sanitize("51S-39466") == "51S-39466"

    def test_sanitize_recovers_series_letter_from_digit(self):
        """A digit misread at the series position is mapped back to a letter."""
        # OCR read series 'B' as '8' -> recovered to 'B'
        assert PlateNormalizer.sanitize("908-12345") == "90B-12345"

    def test_sanitize_two_letter_series_preserved(self):
        """New VN 2-letter series (30AB, 19DE) must keep both letters."""
        # 'B' as 2nd series letter must NOT become '8'
        assert PlateNormalizer.sanitize("30AB-12345") == "30AB-12345"
        assert PlateNormalizer.sanitize("29AB-1234") == "29AB-1234"
        assert PlateNormalizer.sanitize("19DE-12345") == "19DE-12345"

    def test_sanitize_letter_digit_series_preserved(self):
        """Letter+digit series (90B2, 29B1) keeps the trailing digit."""
        assert PlateNormalizer.sanitize("90B2-45230") == "90B2-45230"
        assert PlateNormalizer.sanitize("29B1-23456") == "29B1-23456"

    def test_sanitize_corrects_digit_positions(self):
        """Letter->digit correction still applies at province/serial positions."""
        # Province 'O' -> 0, serial 'S' -> 5
        assert PlateNormalizer.sanitize("5OG-394S6") == "50G-39456"

    def test_sanitize_with_ocr_corrections(self):
        """Digit-position confusions corrected; series letter 'I' preserved."""
        result = PlateNormalizer.sanitize("O1I-Z5B8", apply_ocr_corrections=True)
        assert result == "01I-2588"

    def test_sanitize_unrecognized_shape_returns_raw(self):
        """Non-civilian shapes are returned raw (no risky confusion swaps)."""
        assert PlateNormalizer.sanitize("OIZSB") == "OIZSB"
        assert PlateNormalizer.sanitize("CAR-123") == "CAR-123"
    
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
        """All digit-position confusions corrected within a compliant plate."""
        # O→0, I→1, Z→2, S→5, B→8 at digit slots; 'A' series letter preserved
        result = PlateNormalizer.sanitize("OIAZSB8")
        assert result == "01A2588"


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
        assert result == "90-B245230"
    
    def test_format_vietnamese_2line_no_hyphen(self):
        """Test 2-line without hyphen."""
        result = PlateNormalizer.format_vietnamese_2line("51G", "394.66")
        assert result == "51G39466"
    
    def test_format_vietnamese_2line_with_spaces(self):
        """Test 2-line with spaces."""
        result = PlateNormalizer.format_vietnamese_2line("90 - B2", "452 . 30")
        assert result == "90-B245230"


class TestPlateNormalizerRealWorld:
    """Test with real-world scenarios."""
    
    def test_backend_compatibility(self):
        """
        Test that Python output matches backend JavaScript logic.

        Backend applies position-aware correction (letter->digit at digit
        positions, digit->letter at the series position).
        """
        python_result = PlateNormalizer.sanitize("90-B2 452.30")
        # Both Python and JS produce "90-B245230" (series 'B' preserved)
        assert python_result == "90-B245230"
    
    def test_ocr_dirty_output(self):
        """Test handling of noisy OCR output."""
        result = PlateNormalizer.sanitize("5 1 G - 3 9 4 . 6 6")
        assert result == "51G-39466"
    
    def test_ocr_with_dots_and_spaces(self):
        """Test OCR with common artifacts."""
        result = PlateNormalizer.sanitize("90-B2. 452.30")
        assert result == "90-B245230"
