# Audit Report

Generated: 2025-07-20

## Summary

| Layer | CONFIRMED_DEAD | SUSPICIOUS | Total |
|-------|:-:|:-:|:-:|
| Backend (`be/`) | 4 | 0 | 4 |
| Frontend (`fe/`) | 13 | 3 | 16 |
| LPD (`Licence-Plate-Detection-Recognition-Recording/`) | 4 | 5 | 9 |
| Database Schema | 2 | 1 | 3 |
| Specs (`.kiro/specs/`) | 8 | 0 | 8 |
| Migration Consolidation | — | — | 3 groups |
| Unused Dependencies | 0 | 3 | 3 |
| **Total** | **31** | **12** | **43** |

---

## Backend (`be/`)

### CONFIRMED_DEAD

| File | Item | Evidence | Action |
|------|------|----------|--------|
| `be/repositories/admin.payments.repo.js` | `createMonthlyPayment` | 0 `require()` references from any `.js` file in `be/`; file comment says "dead code — monthlysubs table has been dropped (migration 023)" | REMOVE |
| `be/repositories/employee.sessions.repo.js` | `createPendingPayment` (export) | 0 callers in production or test code. Legacy pre-PayOS checkout flow, superseded by `session.repo.js` + `paymentAttempt.repo.js` | REMOVE export |
| `be/repositories/employee.sessions.repo.js` | `confirmPayment` (export) | 0 callers in production or test code. Legacy direct-confirm checkout flow, superseded by `checkout.service.js` | REMOVE export |
| `be/repositories/employee.sessions.repo.js` | `createAndConfirmPayment` (export) | 0 callers in production or test code. Legacy combined create+confirm flow, superseded by `checkout.service.js` | REMOVE export |

### SUSPICIOUS

*(none)*

---

## Frontend (`fe/`)

### CONFIRMED_DEAD

| File | Item | Evidence | Action |
|------|------|----------|--------|
| `fe/app/components/common/PrintableTicket.jsx` | PrintableTicket | 0 imports found in `fe/app/` or `fe/__tests__/` | REMOVE |
| `fe/app/components/employee/Sidebar.jsx` | Sidebar (deprecated) | File comment says "deprecated — refactored into Navbar.jsx"; 0 imports; exports a no-op component | REMOVE |
| `fe/app/components/employee/PageHeader.jsx` | PageHeader (employee) | 0 imports; all employee pages use common/PageHeader or admin/PageHeader instead | REMOVE |
| `fe/app/components/admin/MonthlySubForm.jsx` | MonthlySubForm | 0 imports; `admin/monthly-subs/` route dir is empty; component never wired up | REMOVE |
| `fe/app/api/employee.audit.client.js` | employee.audit.client module | 0 imports in source; admin audit page uses `fetchAdminAuditSessions` from `admin.client` instead | REMOVE |
| `fe/app/api/employee.client.js` | `fetchHomePage` (export) | Named export never imported by any source or test file | REMOVE export |
| `fe/app/api/employee.client.js` | `fetchActiveSessions` (export) | Named export never imported by any source or test file | REMOVE export |
| `fe/app/api/employee.client.js` | `fetchParkingLots` (export) | Named export never imported; all usages reference `fetchParkingLots` from `admin.client` | REMOVE export |
| `fe/app/employee/checkin/components/ResultPanel.jsx` | ResultPanel | 0 imports; component defined but never rendered | REMOVE |
| `fe/app/admin/monthly-subs/` | empty route directory | No files, no `page.jsx`; MonthlySubForm also dead | REMOVE directory |
| `fe/app/admin/export/` | empty route directory | No files | REMOVE directory |
| `fe/app/admin/import/` | empty route directory | No files | REMOVE directory |
| `fe/app/employee/checkin/rfid/components/` | empty component directory | No files | REMOVE directory |

### SUSPICIOUS

| File | Item | Evidence | Action |
|------|------|----------|--------|
| `fe/app/components/common/WebcamFeed.jsx` | WebcamFeed | Referenced only in test file; 0 imports from production source | REVIEW — may be superseded by KioskCameraPanel |
| `fe/app/components/employee/audit/FilterBar.jsx` | FilterBar | Referenced only in test file; 0 imports from production source | REVIEW — likely dead but has dedicated test |
| `fe/app/components/payment/PayOSEmbed.jsx` | PayOSEmbed | 0 imports from any source or test; referenced in design docs as planned integration | REVIEW — intentional component awaiting wiring |

---

## LPD (`Licence-Plate-Detection-Recognition-Recording/`)

### CONFIRMED_DEAD

| File | Item | Evidence | Action |
|------|------|----------|--------|
| `config/__init__.py` | `config` package | Empty package; zero imports from any `.py` file | REMOVE |
| `repo5/api/app.py` | `repo5.api` FastAPI app | Superseded Plan A FastAPI application; `api_server.py` (Flask) is actual entrypoint per Dockerfile.lpd | REMOVE |
| `repo5/api/__init__.py` | `repo5.api` package init | Part of dead `repo5/api/` package | REMOVE (with parent) |
| `gunicorn.conf.py` | `import multiprocessing` (unused) | Imported at line 6, never referenced in file body | REMOVE import |

### SUSPICIOUS

| File | Item | Evidence | Action |
|------|------|----------|--------|
| `gunicorn.conf.py` | `import os` (unused) | Imported at line 7, never referenced; may be used by gunicorn hooks internally | REVIEW |
| `repo5/core/models.py` | `import torch` (unused) | Never called in file body; may be implicit dependency for `ultralytics.YOLO` model loading | REVIEW |
| `repo5/core/models.py` | `from typing import Any` (unused) | Imported but never used in type annotations | REVIEW |
| `repo5/function/helper.py` | `read_plate()` function | Only called by test file; production uses `read_plate_v8()` exclusively | REVIEW |
| `evaluation/detection_eval.py` | `import tempfile` (unused) | Imported but never used; evaluation module is standalone tool | REVIEW |

---

## Database Schema

### Redundant Tables

*(none found — all 17 active tables are referenced by repository code)*

### Redundant Columns

| Column | Table | Migration | Category | Evidence | Action |
|--------|-------|-----------|----------|----------|--------|
| `next_retry_at` | `edge_events` | `008_edge_events.sql` | CONFIRMED_DEAD | Never read or written by any repo/service/controller; only exists in DDL | `ALTER TABLE edge_events DROP COLUMN IF EXISTS next_retry_at` |
| `metadata_out` | `parkingsessions` | `007_hybrid_edge_checkin.sql` | SUSPICIOUS | Never explicitly read/written; returned implicitly via `SELECT *`; likely placeholder for future checkout enrichment | REVIEW — keep unless feature abandoned |

### Unused Indexes

| Index | Table | Columns | Migration | Category | Evidence | Action |
|-------|-------|---------|-----------|----------|----------|--------|
| `idx_payment_attempts_session_status_created` | `payment_attempts` | `(session_id, status, created_at DESC)` | `003_payment_attempts.sql` | CONFIRMED_DEAD | No repo query uses `WHERE session_id` on `payment_attempts`; Payment Intent V2 routes through `intent_id` instead | `DROP INDEX IF EXISTS idx_payment_attempts_session_status_created` |

### FK-Blocked Candidates

*(none — all flagged items have no inbound FK references)*

---

## Specs (`.kiro/specs/`)

| Spec | Completion | Status | Reason |
|------|:---:|--------|--------|
| `card-pool-management` | 100% (41/41) | CONFIRMED_DEAD | All tasks complete |
| `edge-event-bugs` | 100% (13/13) | CONFIRMED_DEAD | All tasks complete |
| `edge-gateway-simulator` | 100% (23/23) | CONFIRMED_DEAD | All tasks complete |
| `fee-calculation-engine` | 100% (56/56) | CONFIRMED_DEAD | All tasks complete |
| `minio-image-storage` | 100% (32/32) | CONFIRMED_DEAD | All tasks complete |
| `session-audit-viewer` | 100% (28/28) | CONFIRMED_DEAD | All tasks complete |
| `subscription-bug-fixes` | 100% (30/30) | CONFIRMED_DEAD | All tasks complete |
| `unified-checkin-kiosk` | 100% (42/42) | CONFIRMED_DEAD | All tasks complete; superseded by `checkin-kiosk-polish` |

---

## Migration Consolidation Candidates (Informational)

| Files | Target Table | DDL Types |
|-------|-------------|-----------|
| `003_payment_attempts.sql`, `004_payment_intents.sql` | `payment_attempts` | CREATE TABLE (003), ALTER TABLE + CREATE INDEX (004) |
| `011_payment_intent_v2.sql`, `012_payment_intent_v2_impl.sql` | `payment_intents`, `payment_attempts`, `payment` | ALTER TABLE, DROP/CREATE CONSTRAINT, DROP/CREATE INDEX |
| `015_parking_cards.sql`, `016_parking_cards_global_uid.sql` | `parking_cards` | CREATE TABLE (015), ALTER TABLE (016) |

---

## Unused Dependencies

### Backend

*(none — all 19 dependencies confirmed active)*

### Frontend

| Package | Category | Evidence | Action |
|---------|----------|----------|--------|
| `fast-check` (devDependencies) | SUSPICIOUS | Listed in `fe/package.json` but no test file imports it; existing property tests use hand-rolled generators | REVIEW — consider removing; run `npm test` in `fe/` after |

### LPD

| Package | Category | Evidence | Action |
|---------|----------|----------|--------|
| `python-dotenv` | SUSPICIOUS | Zero `import dotenv` or `load_dotenv()` calls found anywhere; no `.flaskenv` file exists | REVIEW — may be vestigial |
| `werkzeug` | SUSPICIOUS | No direct `import werkzeug`; however Flask depends on it internally as WSGI layer | Keep — removing breaks Flask |
