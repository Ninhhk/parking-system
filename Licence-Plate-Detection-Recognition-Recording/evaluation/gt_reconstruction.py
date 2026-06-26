"""Ground-truth plate string reconstruction from YOLO character labels.

Parses YOLO-format per-character annotation files and assembles the full
plate string using the same sort-by-x / split-by-y-mean logic as the
pipeline's read_plate_v8.
"""

from pathlib import Path
from typing import Dict, List


def parse_yolo_label(content: str) -> List[dict]:
    """Parse YOLO label file content into structured character boxes.

    Each line: <class_id> <x_center> <y_center> <width> <height>
    (all normalized 0-1).

    Returns:
        List of dicts with keys: class_id (int), x_center (float), y_center (float).
        Width/height are parsed but not stored (not needed for assembly).
    """
    boxes = []
    for line in content.strip().splitlines():
        parts = line.split()
        if len(parts) < 5:
            continue
        boxes.append({
            "class_id": int(parts[0]),
            "x_center": float(parts[1]),
            "y_center": float(parts[2]),
        })
    return boxes


def assemble_plate_string(boxes: List[dict], names: Dict[int, str]) -> str:
    """Assemble plate string from character boxes using sort-by-x, split-by-y.

    Mirrors the logic in read_plate_v8:
    1. Compute y_mean across all character centers.
    2. Check if any point deviates from the line between leftmost and rightmost
       (simplified: use y-spread threshold to detect 2-line plates).
    3. If 2-line: split into top/bottom by y_mean, sort each by x, join with '-'.
    4. If 1-line: sort all by x, concatenate.

    Args:
        boxes: List of dicts with class_id, x_center, y_center.
        names: Mapping from class_id → character string.

    Returns:
        Assembled plate string.
    """
    if not boxes:
        return ""

    # Map class_id → char
    chars = []
    for box in boxes:
        ch = names.get(box["class_id"], "?")
        chars.append({
            "char": ch,
            "x": box["x_center"],
            "y": box["y_center"],
        })

    # Detect 1-line vs 2-line using the same heuristic as read_plate_v8:
    # check if any point deviates from the line between leftmost and rightmost
    if len(chars) < 2:
        return chars[0]["char"]

    y_values = [c["y"] for c in chars]
    y_mean = sum(y_values) / len(y_values)

    # Use y-spread to decide: if max_y - min_y > threshold, it's 2-line
    # The original code checks point-to-line deviation; we approximate with
    # a spread threshold relative to the y range. A spread > 20% of bbox
    # height (normalized coords) indicates 2-line.
    y_min, y_max = min(y_values), max(y_values)
    y_spread = y_max - y_min

    # Threshold: if spread > 0.2 (20% of image height in normalized coords)
    # AND we have enough chars to split, treat as 2-line.
    # This matches real behavior: 2-line plates have top row at ~0.3 and
    # bottom at ~0.7, giving spread ~0.4.
    is_two_line = y_spread > 0.2 and len(chars) >= 4

    if is_two_line:
        line_1 = sorted(
            [c for c in chars if c["y"] <= y_mean],
            key=lambda c: c["x"],
        )
        line_2 = sorted(
            [c for c in chars if c["y"] > y_mean],
            key=lambda c: c["x"],
        )
        top = "".join(c["char"] for c in line_1)
        bottom = "".join(c["char"] for c in line_2)
        return f"{top}-{bottom}"
    else:
        sorted_chars = sorted(chars, key=lambda c: c["x"])
        return "".join(c["char"] for c in sorted_chars)


def reconstruct_plate(label_content: str, names: Dict[int, str]) -> str:
    """End-to-end: parse label content → assemble plate string.

    Args:
        label_content: Raw text content of a YOLO label file.
        names: class_id → character mapping from model.names.

    Returns:
        Reconstructed plate string (e.g., "90B2-45230" for 2-line).
    """
    boxes = parse_yolo_label(label_content)
    return assemble_plate_string(boxes, names)


def reconstruct_from_file(label_path: Path, names: Dict[int, str]) -> str:
    """Convenience: read a label file and reconstruct the plate string."""
    content = label_path.read_text(encoding="utf-8")
    return reconstruct_plate(content, names)
