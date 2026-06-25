# Dependency Audit Findings

Audit of unused dependencies across all project layers.  
Classification: **CONFIRMED_DEAD** (zero usage found), **SUSPICIOUS** (indirect/unclear usage), **ACTIVE** (confirmed usage in source).

---

## Backend (`be/package.json`)

### dependencies

| Package | Category | Evidence |
|---------|----------|----------|
| `@payos/node` | ACTIVE | `require("@payos/node")` in `services/payos.client.js` |
| `axios` | ACTIVE | `require('axios')` in `services/employee.lpd.service.js` |
| `bcrypt` | ACTIVE | `require("bcrypt")` in `controllers/auth.controller.js`, `repositories/auth.repo.js`, `repositories/admin.users.repo.js`, `utils/pw.js` |
| `cookie-parser` | ACTIVE | `require("cookie-parser")` in `app.js` |
| `cors` | ACTIVE | `require("cors")` in `app.js` |
| `dotenv` | ACTIVE | `require("dotenv")` in `app.js`, `config/db.js`, `config/minio.js` |
| `exceljs` | ACTIVE | `require("exceljs")` in `controllers/admin.batch.controller.js`, `services/batchExport.service.js`, `services/xlsx.helper.js` |
| `express` | ACTIVE | `require("express")` in `app.js`, all route files |
| `express-rate-limit` | ACTIVE | `require("express-rate-limit")` in `routes/auth.routes.js` |
| `express-session` | ACTIVE | `require("express-session")` in `app.js` |
| `minio` | ACTIVE | `require("minio")` in `config/minio.js`, `services/minio.service.js` |
| `morgan` | ACTIVE | `require("morgan")` in `app.js` |
| `multer` | ACTIVE | `require("multer")` in `middlewares/upload.middleware.js` |
| `pg` | ACTIVE | `require('pg')` in `config/db.js` |

### devDependencies

| Package | Category | Evidence |
|---------|----------|----------|
| `autocannon` | ACTIVE | `require("autocannon")` in `load-tests/scenarios/load.js`, `load-tests/scenarios/perf.js` |
| `fast-check` | ACTIVE | `require("fast-check")` in 20+ property test files under `__tests__/` |
| `jest` | ACTIVE | Test runner; configured in `jest.config.js`, invoked via `npm test` |
| `nodemon` | ACTIVE | Referenced in `package.json` scripts: `"dev": "nodemon app.js"` |
| `supertest` | ACTIVE | `require("supertest")` in 8 integration/controller test files |

**Backend summary:** All dependencies are ACTIVE. No dead dependencies found.

---

## Frontend (`fe/package.json`)

### dependencies

| Package | Category | Evidence |
|---------|----------|----------|
| `axios` | ACTIVE | `import axios from "axios"` in `app/api/client.config.js` |
| `next` | ACTIVE | Core framework; used in imports (`next/link`, `next/navigation`), config files |
| `react` | ACTIVE | `import { useState, useEffect, ... } from "react"` in all components |
| `react-chartjs-2` | ACTIVE | `import { Bar, Line, Doughnut } from "react-chartjs-2"` in `admin/insight/page.jsx` |
| `react-dom` | ACTIVE | Required peer dependency of Next.js (no direct import needed) |
| `react-hot-toast` | ACTIVE | `import { toast } from "react-hot-toast"` in multiple pages |
| `react-icons` | ACTIVE | `import { ... } from "react-icons/hi"` in Sidebar, Navbar, pages |

### devDependencies

| Package | Category | Evidence |
|---------|----------|----------|
| `@eslint/eslintrc` | ACTIVE | `import { FlatCompat } from "@eslint/eslintrc"` in `eslint.config.mjs` |
| `@tailwindcss/postcss` | ACTIVE | Referenced in `postcss.config.mjs` as plugin |
| `@testing-library/jest-dom` | ACTIVE | `import "@testing-library/jest-dom"` in `jest.setup.js` |
| `@testing-library/react` | ACTIVE | `import { render, screen, ... } from "@testing-library/react"` in 15+ test files |
| `eslint` | ACTIVE | Lint runner; required by `eslint-config-next` |
| `eslint-config-next` | ACTIVE | Used via `compat.extends("next/core-web-vitals")` in `eslint.config.mjs` |
| `fast-check` | SUSPICIOUS | Listed in `package.json` but test files (`cardUid.property.test.js`, `parkingCards.search.property.test.js`) explicitly state "fast-check is not a dependency" and use hand-rolled generators instead. Possibly added but never actually imported. |
| `jest` | ACTIVE | Test runner; configured in `jest.config.js`, invoked via `npm test` |
| `jest-environment-jsdom` | ACTIVE | `testEnvironment: "jest-environment-jsdom"` in `jest.config.js` |
| `tailwindcss` | ACTIVE | `@import "tailwindcss"` in `globals.css`; core CSS framework |

**Frontend summary:** 1 SUSPICIOUS dependency (`fast-check` — listed but explicitly not used by any test file).

---

## Python LPD (`Licence-Plate-Detection-Recognition-Recording/`)

### requirements.txt (runtime)

| Package | Category | Evidence |
|---------|----------|----------|
| `numpy` | ACTIVE | `import numpy as np` in `api_server.py`, services, tests |
| `ultralytics` | ACTIVE | `from ultralytics import YOLO` in `repo5/core/models.py` |
| `opencv-python-headless` | ACTIVE | pip-name ≠ import-name (`cv2`); `import cv2` in `api_server.py`, services, tests |
| `flask` | ACTIVE | `from flask import Flask, jsonify, request` in `api_server.py` |
| `werkzeug` | SUSPICIOUS | Flask's required WSGI dependency; no direct `import werkzeug` in code, but Flask cannot run without it. Likely needed as transitive dependency pin. |
| `python-dotenv` | SUSPICIOUS | pip-name ≠ import-name (`dotenv`); zero `import dotenv` or `load_dotenv()` calls found anywhere in codebase. May be vestigial or intended for future use. Flask can auto-load `.env` via `python-dotenv` if installed, but no `.flaskenv` file exists. |
| `gunicorn` | ACTIVE | WSGI server; `gunicorn.conf.py` configures it; invoked as CLI entrypoint in Docker |
| `psutil` | ACTIVE | `import psutil` in `api_server.py` metrics endpoint |

### requirements-dev.txt (development)

| Package | Category | Evidence |
|---------|----------|----------|
| `hypothesis` | ACTIVE | `from hypothesis import given, settings` in `tests/unit/test_service_props.py`, `repo5/tests/test_pipeline_props.py` |
| `pytest` | ACTIVE | `import pytest` in all test files; test runner |
| `pytest-cov` | ACTIVE | pytest plugin; loaded automatically when installed; used via `pytest --cov` |
| `pytest-mock` | ACTIVE | pytest plugin; provides `mocker` fixture; loaded automatically |
| `black` | ACTIVE | Code formatter; used via `black --check .` |
| `flake8` | ACTIVE | Linter; used via `flake8 .` |
| `mypy` | ACTIVE | Type checker; used via `mypy .` |

**Python summary:** 2 SUSPICIOUS dependencies (`werkzeug` — Flask transitive dep pin; `python-dotenv` — zero usage found).

---

## Summary

| Layer | Total Deps | ACTIVE | SUSPICIOUS | CONFIRMED_DEAD |
|-------|-----------|--------|------------|----------------|
| Backend (be/) | 19 | 19 | 0 | 0 |
| Frontend (fe/) | 16 | 15 | 1 | 0 |
| Python LPD | 15 | 13 | 2 | 0 |
| **Total** | **50** | **47** | **3** | **0** |

### Actionable Items

1. **`fe/fast-check`** (SUSPICIOUS): Consider removing from `fe/package.json` devDependencies — no test file imports it, and existing property tests use custom generators. Run `npm test` in `fe/` after removal to verify.
2. **`python-dotenv`** (SUSPICIOUS): Zero usage in code. If Flask auto-loading of `.env` is not needed (app uses `os.getenv` directly), safe to remove. Test with `pytest` after removal.
3. **`werkzeug`** (SUSPICIOUS): Likely safe to keep — Flask depends on it internally. Removing would break Flask. Recommend keeping as explicit version pin for reproducible builds.
