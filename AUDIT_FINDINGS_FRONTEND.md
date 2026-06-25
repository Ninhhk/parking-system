# Frontend Dead Code Audit Findings

Audit scope: `fe/app/` (excluding `node_modules/`, `.next/`, `__tests__/`)

## Summary

| Category | Count |
|----------|-------|
| CONFIRMED_DEAD (files) | 5 |
| CONFIRMED_DEAD (unused exports) | 3 |
| SUSPICIOUS (test-only refs) | 2 |
| Empty directories (orphan) | 4 |
| **Total** | **14** |

## Findings

### CONFIRMED_DEAD

| file_path | item_name | category | evidence | recommended_action |
|-----------|-----------|----------|----------|--------------------|
| `fe/app/components/common/PrintableTicket.jsx` | PrintableTicket | CONFIRMED_DEAD | 0 imports found in `fe/app/` or `fe/__tests__/`; never referenced anywhere | REMOVE |
| `fe/app/components/employee/Sidebar.jsx` | Sidebar (deprecated) | CONFIRMED_DEAD | File comment says "deprecated — refactored into Navbar.jsx"; 0 imports found; exports a no-op component | REMOVE |
| `fe/app/components/employee/PageHeader.jsx` | PageHeader (employee) | CONFIRMED_DEAD | 0 imports found in `fe/app/` or `fe/__tests__/`; all employee pages use the common/PageHeader or admin/PageHeader instead | REMOVE |
| `fe/app/components/admin/MonthlySubForm.jsx` | MonthlySubForm | CONFIRMED_DEAD | 0 imports found; `admin/monthly-subs/` route directory is empty (no page); component was never wired up | REMOVE |
| `fe/app/api/employee.audit.client.js` | employee.audit.client module | CONFIRMED_DEAD | 0 imports in source files; admin audit page uses `fetchAdminAuditSessions` from `admin.client` instead; test file `AuditPagePagination.test.jsx` imports the admin version | REMOVE |
| `fe/app/api/employee.client.js` | `fetchHomePage` (export) | CONFIRMED_DEAD | Named export never imported by any source or test file | REMOVE export |
| `fe/app/api/employee.client.js` | `fetchActiveSessions` (export) | CONFIRMED_DEAD | Named export never imported by any source or test file | REMOVE export |
| `fe/app/api/employee.client.js` | `fetchParkingLots` (export) | CONFIRMED_DEAD | Named export never imported; all usages reference `fetchParkingLots` from `admin.client` | REMOVE export |
| `fe/app/employee/checkin/components/ResultPanel.jsx` | ResultPanel | CONFIRMED_DEAD | 0 imports found in `fe/app/` or `fe/__tests__/`; component defined but never rendered | REMOVE |

### SUSPICIOUS

| file_path | item_name | category | evidence | recommended_action |
|-----------|-----------|----------|----------|--------------------|
| `fe/app/components/common/WebcamFeed.jsx` | WebcamFeed | SUSPICIOUS | Referenced only in test file `fe/__tests__/components/WebcamFeed.test.js`; 0 imports from production source files | REVIEW — may be superseded by KioskCameraPanel |
| `fe/app/components/employee/audit/FilterBar.jsx` | FilterBar | SUSPICIOUS | Referenced only in test file `fe/__tests__/employee/audit/FilterBar.test.jsx`; 0 imports from production source; admin audit page builds its own inline filter UI | REVIEW — likely dead but has dedicated test |
| `fe/app/components/payment/PayOSEmbed.jsx` | PayOSEmbed | SUSPICIOUS | 0 imports from any source or test file; referenced in design docs (`docs/superpowers/plans/`) as planned integration; may be intended for future use per payos-checkout steering | REVIEW — intentional component awaiting wiring |

### Orphan Directories (empty, no page.jsx)

| file_path | item_name | category | evidence | recommended_action |
|-----------|-----------|----------|----------|--------------------|
| `fe/app/admin/monthly-subs/` | empty route dir | CONFIRMED_DEAD | Directory exists but contains no files; no page.jsx = no route; MonthlySubForm that would populate it is also dead | REMOVE directory |
| `fe/app/admin/export/` | empty route dir | CONFIRMED_DEAD | Directory exists but contains no files | REMOVE directory |
| `fe/app/admin/import/` | empty route dir | CONFIRMED_DEAD | Directory exists but contains no files | REMOVE directory |
| `fe/app/employee/checkin/rfid/components/` | empty component dir | CONFIRMED_DEAD | Directory exists but contains no files | REMOVE directory |

## Notes

- **Page files** (`page.jsx`, `layout.jsx`) in `app/` directories are auto-routed by Next.js and are NOT flagged as orphans even if never explicitly imported. This includes redirect pages (`employee/audit/page.jsx`, `employee/edge-monitor/page.jsx`, `employee/checkout/[sessionid]/page.jsx`).
- **No dynamic imports** with non-literal arguments were found in `fe/app/`.
- The `PayOSEmbed.jsx` component is a known planned integration (see `payos-checkout` steering file) — marking as SUSPICIOUS rather than dead.
- `WebcamFeed` appears to have been superseded by `KioskCameraPanel` which handles the same camera capture functionality inline.
