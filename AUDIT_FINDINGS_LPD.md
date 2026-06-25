# Audit Findings — LPD Service (`Licence-Plate-Detection-Recognition-Recording/`)

Generated: 2025-01-XX (Task 1.3 of codebase-cleanup spec)

## Summary

| Category | Count |
|----------|------:|
| CONFIRMED_DEAD | 4 |
| SUSPICIOUS | 5 |
| **Total** | **9** |

## Methodology

1. Listed all `.py` files in LPD directory (excluding `.venv/`, `venv/`, `__pycache__/`, `tests/`, `evaluation/tests/`)
2. Identified entrypoints: `api_server.py` (Flask app via Dockerfile.lpd CMD), `gunicorn.conf.py` (gunicorn config)
3. For each non-entrypoint module: checked if imported by any production `.py` file
4. Modules with zero importers from production code = CONFIRMED_DEAD
5. Modules imported only by test files = SUSPICIOUS
6. Within each file: checked for unused imports (imported names never used in file body)
7. Checked for dynamic imports (`import psutil` inside function body in `api_server.py`)

## Findings

### CONFIRMED_DEAD

| file_path | item_name | category | evidence | recommended_action |
|-----------|-----------|----------|----------|-------------------|
| `config/__init__.py` | `config` package | CONFIRMED_DEAD | Empty package (`"""Configuration module."""` only). Zero imports from any `.py` file in the project — `from config` and `import config` return 0 matches. | REMOVE |
| `repo5/api/app.py` | `repo5.api` FastAPI app | CONFIRMED_DEAD | Superseded Plan A FastAPI application. Never imported or referenced by production code. `api_server.py` (Flask) is the actual entrypoint per Dockerfile.lpd CMD `gunicorn ... api_server:app`. Zero references to `repo5/api` in Dockerfile, docker-compose, or any Python file outside `repo5/api/` itself. | REMOVE |
| `repo5/api/__init__.py` | `repo5.api` package init | CONFIRMED_DEAD | Part of the dead `repo5/api/` package (see above). | REMOVE (with parent) |
| `gunicorn.conf.py` → `import multiprocessing` | unused import `multiprocessing` | CONFIRMED_DEAD | Imported at line 6, never referenced in the file body (`multiprocessing.` has 0 matches). Likely leftover from a `workers = multiprocessing.cpu_count()` pattern that was replaced with `workers = 1`. | REMOVE import |

### SUSPICIOUS

| file_path | item_name | category | evidence | recommended_action |
|-----------|-----------|----------|----------|-------------------|
| `gunicorn.conf.py` → `import os` | unused import `os` | SUSPICIOUS | Imported at line 7, never referenced in the file body (`os.` has 0 matches). May be used by gunicorn itself via `raw_env` evaluation or hook context — cannot statically verify. | REVIEW |
| `repo5/core/models.py` → `import torch` | unused import `torch` | SUSPICIOUS | Imported at line 12, never called in the file body (`torch.` has 0 matches). May be needed as an implicit dependency for `ultralytics.YOLO` model loading. Removing could cause runtime failure. | REVIEW |
| `repo5/core/models.py` → `from typing import Any` | unused import `Any` | SUSPICIOUS | Imported at line 10, never used in type annotations. Low risk but technically dead. | REVIEW |
| `repo5/function/helper.py` → `read_plate()` | function `read_plate` (YOLOv5 Plan A) | SUSPICIOUS | Only called by `repo5/tests/test_helper.py` (test file). Not called by any production code — `repo5/core/pipeline.py` uses `helper.read_plate_v8()` exclusively. However, it's in the same file as the active `read_plate_v8` function. Referenced only in test files. | REVIEW |
| `evaluation/detection_eval.py` → `import tempfile` | unused import `tempfile` | SUSPICIOUS | Imported at line 12, never used in the file body. Evaluation module is a standalone tool (not production code), so lower priority. | REVIEW |

## Notes

### Evaluation Module (`evaluation/`)

The entire `evaluation/` directory is a **standalone evaluation toolkit** — it is never imported by production code (`api_server.py`, `services/`, `repo5/core/`). It imports FROM production (`services.plate_normalizer`) but nothing imports FROM it.

However, this module is **not dead code** — it is a deliberately standalone CLI tool (`python -m evaluation.detection_eval`, etc.) used for thesis evaluation/reporting. It has its own test suite under `evaluation/tests/` (not configured in main `pytest.ini`). Classification: **ACTIVE (standalone tool)**.

### `models/` Directory

The `models/` directory contains `best.pt` and `LP_ocr_yolov8.pt`. No Python code references this path — production uses `repo5/model/` instead. However, these `.pt` files are already covered by `.gitignore` (`*.pt` rule). No action needed.

### `outputs/` Directory

Already covered by `.gitignore` (`outputs/` rule). No action needed.

### Dynamic Import: `psutil`

`api_server.py` line 199 has `import psutil` inside the `/api/metrics` endpoint function body. This is a **legitimate lazy import** (guarded by `try/except ImportError`). `psutil` is listed in `requirements.txt`. Classification: ACTIVE.

### `repo5/api/app.py` Context

This was the original "Plan A" FastAPI implementation. It was superseded by the Flask-based `api_server.py` (Plan B/current). The Dockerfile.lpd explicitly runs `gunicorn ... api_server:app`, confirming `repo5/api/app.py` is unused. Its test file `repo5/tests/test_api.py` would also become orphaned if the app is removed.

### Unused typing imports in `evaluation/ocr_normalizer_eval.py`

`Dict` and `Optional` from `typing` are imported but unused. Low priority since evaluation is a standalone tool.
