"""License plate normalization service.

This module ensures Python normalization matches the backend logic exactly.
All OCR corrections and sanitization rules must be synchronized with
be/utils/licensePlate.js

OCR corrections are applied POSITION-AWARE, not globally. Vietnamese civilian
plates follow the structure: <2 province digits><1-2 series letters [+ digit]><serial digits>
(cars: 30A-12345 or 30AB-12345, motorbikes: 90-B2 45230 or 19-DE 12345). Series
letters must never be coerced into digits (the classic "90B2" -> "9082" bug, or
"30AB" -> "30A8", caused by a global B->8 replace). We therefore only fix a
character toward the class its position expects:
  - digit positions (province + serial): letter -> digit  (O->0, I->1, Z->2, S->5, B->8)
  - series-letter positions:              digit  -> letter (0->O, 1->I, 2->Z, 5->S, 8->B)
The series spans index 2 (always a letter) and, for 2-letter series, index 3.
If the cleaned string does not match the expected civilian-plate shape, we return
it raw (no confusion correction) rather than risk corrupting it.
"""
import re
from typing import Optional, Set


class PlateNormalizer:
    """
    Normalizes license plate strings using rules matching the backend.

    The normalization process:
    1. Trim and convert to uppercase
    2. Remove invalid characters (keep only A-Z, 0-9, -)
    3. Collapse multiple hyphens and trim leading/trailing hyphens
    4. Apply position-aware OCR corrections when the plate matches the
       Vietnamese civilian structure; otherwise leave it untouched
    """

    # Allowed characters in normalized plates
    ALLOWED_CHARS: Set[str] = set("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-")

    # Letter -> digit corrections, applied only at digit positions
    CHAR_TO_INT = {
        'O': '0',
        'I': '1',
        'Z': '2',
        'S': '5',
        'B': '8',
    }

    # Digit -> letter corrections, applied only at the series-letter position
    INT_TO_CHAR = {
        '0': 'O',
        '1': 'I',
        '2': 'Z',
        '5': 'S',
        '8': 'B',
    }

    # Valid alphanumeric length range for VN civilian plates
    # car 1-letter: 2 + 1 + 4/5 = 7/8, motorbike: 2 + 1 + 1 + 4/5 = 8/9,
    # car/2-letter series (30AB, 19DE): 2 + 2 + 4/5 = 8/9
    MIN_CORE_LEN = 7
    MAX_CORE_LEN = 9

    def __init__(self):
        """Initialize PlateNormalizer instance."""
        pass

    @classmethod
    def _is_series_letter_slot(cls, index: int, ch: str, length: int) -> bool:
        """
        Decide whether a position holds a series LETTER (vs a digit).

        VN civilian series is 1-2 chars right after the 2 province digits:
          - index 2 is always a letter (every plate has at least one series letter)
          - index 3 is a second series letter only for 2-letter series (30AB, 19DE).
            We treat it as a letter when the core is long enough to leave a valid
            4-5 digit serial (length >= 8) AND OCR actually saw an alphabetic char.
            At length 7 the serial would be too short, so index 3 must be a digit.
            (Letter+digit series like "90B2" keep the digit at index 3 naturally,
            since '2' is not alphabetic.)
        """
        if index == 2:
            return True
        if index == 3 and length >= 8 and ch.isalpha():
            return True
        return False

    @classmethod
    def _correct_vn_plate(cls, core: str) -> Optional[str]:
        """
        Apply position-aware OCR correction to an alphanumeric plate core.

        Args:
            core: Uppercased plate with all separators removed (e.g. "90B245230")

        Returns:
            The corrected core if it matches the VN civilian structure,
            otherwise None (caller should fall back to the raw string).
        """
        if not (cls.MIN_CORE_LEN <= len(core) <= cls.MAX_CORE_LEN):
            return None

        out = []
        for i, ch in enumerate(core):
            if cls._is_series_letter_slot(i, ch, len(core)):
                # Series-letter position: must end up a letter
                if ch.isalpha():
                    out.append(ch)
                elif ch in cls.INT_TO_CHAR:
                    out.append(cls.INT_TO_CHAR[ch])
                else:
                    return None
            else:
                # Province / serial position: must end up a digit
                if ch.isdigit():
                    out.append(ch)
                elif ch in cls.CHAR_TO_INT:
                    out.append(cls.CHAR_TO_INT[ch])
                else:
                    return None
        return "".join(out)

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
            "90-B245230"
            >>> PlateNormalizer.sanitize("51G-394.66")
            "51G-39466"
            >>> PlateNormalizer.sanitize("O1I-Z5B8", apply_ocr_corrections=False)
            "O1I-Z5B8"
        """
        if not raw or not isinstance(raw, str):
            return ""

        # Step 1: Trim and uppercase
        plate = raw.strip().upper()

        # Step 2: Remove invalid characters (keep only A-Z, 0-9, -)
        plate = re.sub(r'[^A-Z0-9-]', '', plate)

        # Step 3: Collapse multiple hyphens and trim edges
        plate = re.sub(r'-+', '-', plate)
        plate = plate.strip('-')

        if not apply_ocr_corrections:
            return plate

        # Step 4: Position-aware OCR correction on the alphanumeric core.
        core = plate.replace('-', '')
        corrected = cls._correct_vn_plate(core)
        if corrected is None:
            # Shape not recognized -> return raw (no risky confusion swaps)
            return plate

        # Re-insert corrected characters, preserving original hyphen positions
        result = []
        idx = 0
        for ch in plate:
            if ch == '-':
                result.append('-')
            else:
                result.append(corrected[idx])
                idx += 1
        return "".join(result)

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
            Joined and sanitized plate (e.g., "90-B245230")

        Examples:
            >>> PlateNormalizer.format_vietnamese_2line("90-B2", "452.30")
            "90-B245230"
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
