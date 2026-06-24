"""Evaluation metrics: edit distance, CER, exact-match, canonicalization.

No external dependencies — edit distance is a pure DP implementation.
"""

import re
from typing import List


def edit_distance(a: str, b: str) -> int:
    """Levenshtein edit distance between two strings.

    Args:
        a: First string.
        b: Second string.

    Returns:
        Minimum number of single-character edits (insert/delete/substitute).
    """
    m, n = len(a), len(b)
    # Use O(n) space — only need previous row
    prev = list(range(n + 1))
    for i in range(1, m + 1):
        curr = [i] + [0] * n
        for j in range(1, n + 1):
            if a[i - 1] == b[j - 1]:
                curr[j] = prev[j - 1]
            else:
                curr[j] = 1 + min(prev[j - 1], prev[j], curr[j - 1])
        prev = curr
    return prev[n]


def canonicalize(s: str) -> str:
    """Strip non-alphanumeric characters and uppercase.

    This ensures comparison ignores cosmetic differences (hyphens, dots,
    spaces, case) that don't affect plate identity.
    """
    return re.sub(r"[^A-Z0-9]", "", s.upper())


def cer(pred: str, gt: str) -> float:
    """Character Error Rate = edit_distance(pred, gt) / len(gt).

    Args:
        pred: Predicted (canonicalized) plate string.
        gt: Ground-truth (canonicalized) plate string.

    Returns:
        CER as a float. Returns 0.0 if gt is empty (avoid div-by-zero).
    """
    if not gt:
        return 0.0
    return edit_distance(pred, gt) / len(gt)


def exact_match(pred: str, gt: str) -> bool:
    """Check if pred matches gt after canonicalization.

    Strips hyphens/dots/spaces and uppercases both before comparing.
    """
    return canonicalize(pred) == canonicalize(gt)


def aggregate(rows: List[dict]) -> dict:
    """Aggregate per-sample evaluation rows into summary statistics.

    Each row is expected to have keys:
        raw_match (bool), norm_match (bool), raw_cer (float), norm_cer (float)

    Returns:
        Dict with n, raw_exact_match_rate, norm_exact_match_rate,
        raw_mean_cer, norm_mean_cer, improved, regressed, unchanged.
    """
    n = len(rows)
    if n == 0:
        return {
            "n": 0,
            "raw_exact_match_rate": 0.0,
            "norm_exact_match_rate": 0.0,
            "raw_mean_cer": 0.0,
            "norm_mean_cer": 0.0,
            "improved": 0,
            "regressed": 0,
            "unchanged": 0,
        }

    raw_matches = sum(1 for r in rows if r["raw_match"])
    norm_matches = sum(1 for r in rows if r["norm_match"])
    raw_cer_sum = sum(r["raw_cer"] for r in rows)
    norm_cer_sum = sum(r["norm_cer"] for r in rows)

    # Count transitions
    improved = sum(1 for r in rows if not r["raw_match"] and r["norm_match"])
    regressed = sum(1 for r in rows if r["raw_match"] and not r["norm_match"])
    unchanged = n - improved - regressed

    return {
        "n": n,
        "raw_exact_match_rate": raw_matches / n,
        "norm_exact_match_rate": norm_matches / n,
        "raw_mean_cer": raw_cer_sum / n,
        "norm_mean_cer": norm_cer_sum / n,
        "improved": improved,
        "regressed": regressed,
        "unchanged": unchanged,
    }
