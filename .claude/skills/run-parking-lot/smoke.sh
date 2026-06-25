#!/usr/bin/env bash
# Smoke test driver for parking-lot system.
# Usage: bash .claude/skills/run-parking-lot/smoke.sh
# Prerequisites: docker compose up -d --build (backend services) + npm run dev (frontend)
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASS="${GREEN}PASS${NC}"
FAIL="${RED}FAIL${NC}"
WARN="${YELLOW}WARN${NC}"

BE="${BACKEND_URL:-http://localhost:5000}"
FE="${FRONTEND_URL:-http://localhost:3000}"
LPD="${LPD_URL:-http://localhost:8000}"
COOKIE_FILE=$(mktemp)
PASS_COUNT=0
FAIL_COUNT=0

cleanup() { rm -f "$COOKIE_FILE"; }
trap cleanup EXIT

say() { echo -e "$@"; }
pass() { say "  $PASS: $1"; PASS_COUNT=$((PASS_COUNT + 1)); }
fail() { say "  $FAIL: $1 — $2"; FAIL_COUNT=$((FAIL_COUNT + 1)); }
warn() { say "  $WARN: $1 — $2"; }

check_status() {
    local desc="$1" expected="$2" actual="$3"
    if [ "$actual" = "$expected" ]; then pass "$desc"; else fail "$desc" "expected $expected, got $actual"; fi
}

check_contains() {
    local desc="$1" needle="$2" haystack="$3"
    if echo "$haystack" | grep -q "$needle"; then pass "$desc"; else fail "$desc" "response missing '$needle'"; fi
}

echo ""
say "${YELLOW}=== Parking Lot Smoke Test ===${NC}"
say "Backend:  $BE"
say "Frontend: $FE"
say "LPD:      $LPD"
say "Started at $(date -u +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u)"
echo ""

# ── 1. Health checks ──────────────────────────────────────────────
say "${YELLOW}[1/5] Health checks${NC}"

if BE_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" "$BE/health" 2>/dev/null); then
    check_status "Backend /health → 200" "200" "$BE_HEALTH"
else
    fail "Backend /health" "connection refused — is docker compose up?"
fi

if LPD_HEALTH=$(curl -s "$LPD/health" 2>/dev/null); then
    check_contains "LPD /health → ok" '"status":"ok"' "$LPD_HEALTH"
else
    warn "LPD /health" "not reachable (LPD may be down)"
fi

if FE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$FE" 2>/dev/null); then
    check_status "Frontend / → 200" "200" "$FE_STATUS"
else
    warn "Frontend /" "not reachable — is 'npm run dev' running in fe/?"
fi

# ── 2. Auth ───────────────────────────────────────────────────────
say "${YELLOW}[2/5] Authentication${NC}"

LOGIN_RESP=$(curl -s -c "$COOKIE_FILE" -X POST "$BE/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"username":"ninh1","password":"ninh1"}')
check_contains "POST /api/auth/login" '"success":true' "$LOGIN_RESP"

ME_RESP=$(curl -s -b "$COOKIE_FILE" "$BE/api/auth/me")
check_contains "GET /api/auth/me" '"username":"ninh1"' "$ME_RESP"

# Test login failure
LOGIN_FAIL=$(curl -s -X POST "$BE/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"username":"ninh1","password":"wrong"}')
check_contains "Login with bad password rejects" '"success":false' "$LOGIN_FAIL"

# ── 3. Employee operations ────────────────────────────────────────
say "${YELLOW}[3/5] Employee operations${NC}"

DASH_RESP=$(curl -s -b "$COOKIE_FILE" "$BE/api/employee/")
check_contains "GET /api/employee/ (dashboard)" '"success":true' "$DASH_RESP"

LOTS_RESP=$(curl -s -b "$COOKIE_FILE" "$BE/api/employee/parking-lots")
check_contains "GET /api/employee/parking-lots" '"success":true' "$LOTS_RESP"
check_contains "Parking lots has Main Lot" 'Main Lot' "$LOTS_RESP"

SESSIONS_RESP=$(curl -s -b "$COOKIE_FILE" "$BE/api/employee/parking-sessions")
check_contains "GET /api/employee/parking-sessions" '"success":true' "$SESSIONS_RESP"

# ── 4. Check-in / Checkout flow ───────────────────────────────────
say "${YELLOW}[4/5] Check-in → Checkout flow${NC}"

TS=$(date +%s)
TEST_PLATE="30A$(printf '%05d' $((TS % 100000)))"
TEST_CARD="SMOKE_${TS}"

CHECKIN_RESP=$(curl -s -b "$COOKIE_FILE" -X POST "$BE/api/employee/parking/entry" \
    -H "Content-Type: application/json" \
    -d "{\"license_plate\":\"$TEST_PLATE\",\"vehicle_type\":\"car\",\"card_uid\":\"$TEST_CARD\"}")
check_contains "POST /api/employee/parking/entry (check-in)" '"success":true' "$CHECKIN_RESP"

SESSION_ID=$(echo "$CHECKIN_RESP" | grep -o '"session_id":[0-9]*' | head -1 | cut -d: -f2)
if [ -z "$SESSION_ID" ]; then
    fail "Extract session_id from check-in" "could not parse session_id"
else
    pass "Extracted session_id=$SESSION_ID"

    CHECKOUT_RESP=$(curl -s -b "$COOKIE_FILE" "$BE/api/employee/parking/exit/$SESSION_ID")
    check_contains "GET /api/employee/parking/exit/:id (checkout)" '"success":true' "$CHECKOUT_RESP"
    check_contains "Checkout shows amount" '"amount"' "$CHECKOUT_RESP"
fi

# ── 5. Auth guard ─────────────────────────────────────────────────
say "${YELLOW}[5/5] Auth guards${NC}"

NOAUTH_RESP=$(curl -s -o /dev/null -w "%{http_code}" "$BE/api/employee/")
check_status "GET /api/employee/ without cookie → 401" "401" "$NOAUTH_RESP"

# ── Summary ───────────────────────────────────────────────────────
echo ""
TOTAL=$((PASS_COUNT + FAIL_COUNT))
if [ "$FAIL_COUNT" -eq 0 ]; then
    say "${GREEN}=== All $PASS_COUNT checks passed ===${NC}"
else
    say "${RED}=== $FAIL_COUNT/$TOTAL checks FAILED ===${NC}"
fi
echo ""

exit $FAIL_COUNT
