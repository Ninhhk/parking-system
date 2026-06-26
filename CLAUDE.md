# AGENTS.md

Guidance for agentic coding assistants in this repo.

## Agent Operating Rules

- Non-verbose by default. Concise, direct, high-signal.
- Follow Clean Code. Apply design patterns when they improve clarity/extensibility/maintainability.
- Senior-level review bar: correctness, reliability, security, performance, test quality, maintainability.
- Explain **why** (intent, trade-off, impact) not just **how**.

## Karpathy Coding Guidelines

Behavioral rules to reduce common LLM coding mistakes. **Tradeoff:** caution over speed. For trivial tasks, use judgment.

### 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

- State assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it — don't delete it.
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

### 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

## Scope

- Whole repo rooted at `parking-lot/`.
- Polyglot:
  - `be/`: Node.js + Express backend
  - `fe/`: Next.js frontend
  - `Licence-Plate-Detection-Recognition-Recording/`: Python OCR/LPD service
  - `db/init/`: SQL schema + migrations

## Environment and Tooling

- Node: `npm` (both `be/` and `fe/`)
- Python: `pip` + `venv`
- Orchestration: `docker compose`
- Ports: Frontend `3000`, Backend `5000`, LPD `8000`, Postgres `55432`

## Build, Lint, and Test Commands

Run from package directory unless noted.

### Backend (`be/`)

- Install: `npm install`
- Dev: `npm run dev`
- Test (unit): `npm test`
- Watch: `npm run test:watch`
- Coverage: `npm run test:coverage`
- Single file: `npx jest __tests__/services/checkout.service.test.js`
- Single test: `npx jest __tests__/services/checkout.service.test.js -t "createIntent rejects tampered requested amount"`
- Pattern: `npx jest paymentIntent`
- Integration tests (requires Docker PostgreSQL running on port 55432):
  ```
  DB_HOST=localhost DB_PORT=55432 DB_USER=admin DB_PASSWORD=password123 DB_NAME=parking_lot npx jest --testPathPattern="integration|concurrency|repo" --runInBand --forceExit
  ```
- Single integration file: `DB_HOST=localhost npx jest __tests__/services/checkin.concurrency.test.js --runInBand --forceExit`

> **Note:** Integration tests must run with `--runInBand` (serial) because multiple test files share the same DB pool. Running in parallel causes `pool.end()` in one file to kill connections for others. The `be/.env` has `DB_HOST=postgres` (Docker-internal hostname) — override with `DB_HOST=localhost` when running tests from the host machine.

### Frontend (`fe/`)

- Install: `npm install`
- Dev: `npm run dev`
- Build: `npm run build`
- Start prod: `npm run start`
- Lint: `npm run lint`
- Test: `npm test`
- Single file: `npx jest __tests__/api/employee.payment.client.test.js`
- Single test: `npx jest __tests__/api/employee.payment.client.test.js -t "fetchPaymentStatus calls status endpoint"`
- Pattern: `npx jest WebcamFeed`

### Python LPD (`Licence-Plate-Detection-Recognition-Recording/`)

- Venv: `python -m venv .venv`
- Activate: `.venv\Scripts\Activate.ps1`
- Runtime deps: `pip install -r requirements.txt`
- Dev deps: `pip install -r requirements-dev.txt`
- Test: `pytest`
- Coverage: `pytest --cov=. --cov-report=term-missing`
- Lint: `flake8 .`
- Format: `black --check .`
- Types: `mypy .`
- Single file: `pytest tests/unit/test_normalizer.py`
- Single fn: `pytest tests/unit/test_normalizer.py::TestPlateNormalizerSanitize::test_sanitize_simple_plate`
- Marker: `pytest -m unit`

### Docker (repo root)

- Start: `docker compose up -d --build`
- Status: `docker compose ps`
- Logs: `docker compose logs backend --tail 200`
- Re-migrate (safe, keeps data): `docker compose up -d db-migrate`
- Rebuild backend (pick up code changes): `docker compose build --no-cache backend && docker compose up -d backend`
- Restart (keeps data): `docker compose down && docker compose up -d --build`
- Full reset (⚠️ DELETES ALL DATA): `docker compose down -v && docker compose up -d --build`

> **Note:** The `-v` flag in `docker compose down -v` removes the `postgres_data` volume, wiping all database data. Use `docker compose down` (without `-v`) to preserve data between restarts. Migrations are idempotent (`IF NOT EXISTS` / `ON CONFLICT DO NOTHING`) so re-running them is always safe.

> **Note:** `be/.env` has `DB_PORT=55432` for host-machine access. Inside Docker, services connect on port `5432` (the internal Postgres port). The `docker-compose.yml` hardcodes `DB_PORT: "5432"` in the `environment` section for `backend` and `db-migrate` to override the env_file value. Do NOT change this to `55432` — that's only for host→container connections.

## Coding Conventions

Follow existing patterns. No new frameworks/tools unless requested.

### JavaScript / Node (`be/`)

- CommonJS (`require`, `module.exports`)
- Double quotes (newer files); preserve local style in touched files
- 4 spaces indent
- Files: `feature.layer.js` (e.g., `employee.payment.controller.js`)
- Vars/fns: `camelCase`. Constants: `UPPER_SNAKE_CASE`
- Layering: `routes` → `controllers` → `services` → `repositories` → DB
- SQL stays in repository layer
- Validate params/body early in controllers. Return `422` for invalid input.
- `try/catch` in controllers + service boundaries
- Response: `{ success: false, message: string }`. No stack traces in responses.
- Transactions: explicit `BEGIN/COMMIT/ROLLBACK`, `client.release()` in `finally`

### React / Next (`fe/`)

- Next.js App Router (`app/` dir)
- Function components, default export for pages
- `"use client"` when using hooks/browser APIs
- Preserve existing import conventions (`@/` alias or relative)
- Components: `PascalCase`. Hooks: `useXxx`. Vars: `camelCase`
- Don't rename existing route folders
- Tailwind utility classes, follow existing composition style
- Surface API failures with toast/error state
- Optional chaining: `error.response?.data?.message`

### Python (`Licence-Plate-Detection-Recognition-Recording/`)

- Black-compatible, Flake8-clean
- Type hints on public functions/class interfaces
- `snake_case` modules/fns/vars, `PascalCase` classes, `UPPER_SNAKE_CASE` constants
- Tests: `test_*.py` files, `Test*` classes, `test_*` functions
- Deterministic tests, no external network unless integration-scoped

## Testing Expectations

- Run smallest relevant test first (single-file/single-test)
- Then run full suite (`npm test` or `pytest`) for affected project
- Cross-boundary changes: integration check via Docker when feasible
- No success claims without command evidence

## Change Discipline

- Minimal, scoped changes only
- Preserve API contracts/response envelopes unless task requires changes
- No unrelated refactors
- Never commit secrets (`.env`, credentials, keys)
- Update docs when changing commands, env vars, or visible behavior

## Design Philosophy & Scope Context

**Đồ án tốt nghiệp** (graduation thesis). Prof expects prod-level app. Balance academic rigor with practical scope.

### Guiding Principles

1. **Lean over enterprise**: Minimum code that solves problem correctly. No speculative abstractions, no "just in case" config, no premature optimization.
2. **Signal over ceremony**: Every hardening measure must (a) answer likely defense question, or (b) appear as bullet in báo cáo. Otherwise skip.
3. **Clean Code pragmatically**: Single responsibility, meaningful names, small functions, no dead code. Don't refactor working code to satisfy textbook pattern.
4. **Prod signals, not prod scale**: Implement security/reliability that shows engineering thinking (rate limiting, session hardening, pool config, structured error logging). Don't build for 10k req/s or multi-region.
5. **No over-engineering**: If reviewer asks "over-engineered?" answer must be no. One rate limiter on login > every endpoint. SameSite cookie > CSRF token library. `console.error(JSON.stringify({...}))` > winston/pino.

### What "prod-level" means here

- ✅ Advisory locks, FOR UPDATE, atomic capacity checks, unique partial indexes
- ✅ Timing-safe API key comparison
- ✅ Session: HttpOnly + SameSite + secure in prod + secret validated at startup
- ✅ Rate limiting on brute-force vectors (login, register)
- ✅ Bounded DB pool with connection timeout (no infinite hangs)
- ✅ Request logging (morgan) + structured error context (method, path, userId)
- ❌ Full CSRF token middleware (SameSite sufficient)
- ❌ Rate limiting every endpoint (diminishing returns)
- ❌ Structured logging library with levels/transports (console fine)
- ❌ Correlation IDs / distributed tracing (single-service)
- ❌ Helmet.js / CSP headers (nice-to-have, not defense-critical)

### Review Bar for Agents

- Does this trace to user requirement or likely defense question?
- Could senior engineer call this overcomplicated? If yes, simplify.
- Is diff minimal? Every changed line must justify existence.
- New dependency? Only if alternative is significantly more code or less correct.

## Quick File Map

- Backend entrypoint: `be/app.js`
- Backend tests: `be/__tests__/`
- Frontend config: `fe/next.config.mjs`, `fe/eslint.config.mjs`
- Frontend tests: `fe/__tests__/`
- Python test config: `Licence-Plate-Detection-Recognition-Recording/pytest.ini`
- SQL migrations: `db/init/*.sql`
