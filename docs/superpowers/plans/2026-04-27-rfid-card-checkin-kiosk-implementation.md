# RFID Card Check-in Kiosk Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a modular kiosk-style RFID check-in flow that uses a dedicated backend endpoint and real DB-backed check-in behavior, controlled by environment feature flags.

**Architecture:** Add a dedicated employee RFID entry API (`/employee/parking/entry/rfid`) that reuses existing parking-session creation rules and DB constraints, then add a new FE kiosk page (`/employee/checkin/rfid`) composed from feature-flagged modules. Keep existing check-in endpoint/page intact and isolate RFID behavior behind explicit module and feature flags.

**Tech Stack:** Node.js + Express + Jest (backend), Next.js App Router + React + Tailwind + Jest Testing Library (frontend), PostgreSQL schema already in place.

---

## File Structure (Create/Modify Map)

- Modify: `be/config/constants.js` (add backend RFID feature flag export)
- Modify: `be/controllers/employee.sessions.controller.js` (add dedicated RFID check-in handler)
- Modify: `be/routes/employee.routes.js` (add `/parking/entry/rfid` route)
- Create: `be/__tests__/controllers/employee.sessions.rfid.controller.test.js` (isolated RFID controller tests)
- Modify: `fe/app/api/employee.client.js` (add RFID API client function)
- Create: `fe/__tests__/api/employee.client.test.js` (API client contract tests)
- Create: `fe/app/employee/checkin/rfid/flags.js` (env-flag parsing for modules)
- Create: `fe/app/employee/checkin/rfid/state.js` (kiosk state constants + status mapping)
- Create: `fe/app/employee/checkin/rfid/modules.js` (module registry)
- Create: `fe/app/employee/checkin/rfid/components/ReaderPanel.jsx`
- Create: `fe/app/employee/checkin/rfid/components/VehicleFormPanel.jsx`
- Create: `fe/app/employee/checkin/rfid/components/ResultPanel.jsx`
- Create: `fe/app/employee/checkin/rfid/components/GateStatusPanel.jsx`
- Create: `fe/app/employee/checkin/rfid/components/RecentEventsPanel.jsx`
- Create: `fe/app/employee/checkin/rfid/page.jsx` (kiosk page)
- Create: `fe/__tests__/employee/rfid-kiosk.flags.test.js` (module flag behavior)
- Create: `fe/__tests__/employee/rfid-kiosk.page.test.js` (state flow mapping tests)
- Modify: `fe/app/components/employee/Sidebar.jsx` (add RFID Kiosk nav item)
- Modify: `.env.example` (document `RFID_CHECKIN_ENABLED`)

### Task 1: Backend RFID feature gate + dedicated route

**Files:**
- Modify: `be/config/constants.js`
- Modify: `be/routes/employee.routes.js`
- Test: `be/__tests__/controllers/employee.sessions.rfid.controller.test.js`

- [ ] **Step 1: Write failing route-level test skeleton for dedicated endpoint behavior contract**

```js
describe("employee.sessions.controller checkInByRfid", () => {
    it("returns 503 when RFID_CHECKIN_ENABLED is false", async () => {
        // test body added in Task 2
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/controllers/employee.sessions.rfid.controller.test.js -t "returns 503 when RFID_CHECKIN_ENABLED is false"`
Expected: FAIL (file/test not found yet)

- [ ] **Step 3: Add backend feature flag constant**

```js
// Feature Flags
const PAYMENT_INTENT_V2_ENABLED = String(process.env.PAYMENT_INTENT_V2_ENABLED || 'true') === 'true';
const RFID_CHECKIN_ENABLED = String(process.env.RFID_CHECKIN_ENABLED || 'true') === 'true';

module.exports = {
    // Feature Flags
    PAYMENT_INTENT_V2_ENABLED,
    RFID_CHECKIN_ENABLED,
};
```

- [ ] **Step 4: Add dedicated RFID entry route**

```js
router.post("/parking/entry/rfid", sessionsController.checkInByRfid);
```

- [ ] **Step 5: Run backend lint-equivalent verification via targeted tests (still expected fail before controller exists)**

Run: `npx jest __tests__/controllers/employee.sessions.rfid.controller.test.js`
Expected: FAIL with `checkInByRfid is not a function`

- [ ] **Step 6: Commit routing + constants groundwork**

```bash
git add be/config/constants.js be/routes/employee.routes.js
git commit -m "chore(checkin): add RFID check-in feature flag and endpoint route"
```

### Task 2: Backend controller implementation for `/parking/entry/rfid`

**Files:**
- Modify: `be/controllers/employee.sessions.controller.js`
- Create: `be/__tests__/controllers/employee.sessions.rfid.controller.test.js`
- Test: `be/__tests__/controllers/employee.sessions.controller.test.js`

- [ ] **Step 1: Write failing controller tests with real response contract**

```js
it("returns 422 when card_uid is missing", async () => {
    const req = { body: { vehicle_type: "car" }, session: { user: { user_id: 11 } } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    await controller.checkInByRfid(req, res);

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Missing required fields",
    });
});

it("returns 201 and ticket when card_uid + vehicle_type are valid", async () => {
    // mock lot + startSession success
});

it("returns 409 on uq_active_session_card_uid conflict", async () => {
    // mock startSession reject code 23505 + card constraint
});

it("returns 503 when RFID feature is disabled", async () => {
    // mock constants.RFID_CHECKIN_ENABLED=false using isolateModules
});
```

- [ ] **Step 2: Run test to verify failures**

Run: `npx jest __tests__/controllers/employee.sessions.rfid.controller.test.js`
Expected: FAIL because handler does not exist yet

- [ ] **Step 3: Implement `checkInByRfid` in sessions controller using existing DB flow**

```js
const { LICENSE_PLATE_REGEX, VALID_PAYMENT_METHODS, RFID_CHECKIN_ENABLED } = require("../config/constants");

exports.checkInByRfid = async (req, res) => {
    try {
        if (!RFID_CHECKIN_ENABLED) {
            return res.status(503).json({
                success: false,
                message: "RFID check-in is disabled",
            });
        }

        const {
            card_uid,
            vehicle_type,
            license_plate: raw_license_plate,
            entry_lane_id,
            etag_epc,
            image_in_url,
            metadata_in,
        } = req.body;

        const { sanitizePlate } = require("../utils/licensePlate");
        const license_plate = sanitizePlate(raw_license_plate);

        if (!card_uid || !vehicle_type) {
            return res.status(422).json({ success: false, message: "Missing required fields" });
        }

        if (license_plate && !LICENSE_PLATE_REGEX.test(license_plate)) {
            return res.status(422).json({ success: false, message: "Invalid license plate format" });
        }

        // resolve employee lot + startSession (same pattern as checkInVehicle)
        // map DB unique constraint and capacity errors to current response envelopes
    } catch (error) {
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};
```

- [ ] **Step 4: Ensure unique/capacity error mapping remains production-consistent**

```js
if (error.code === "23505" && ["uq_active_session_card_uid", "uq_active_session_etag_epc"].includes(error.constraint)) {
    return res.status(409).json({
        success: false,
        message: "This vehicle already has an active session",
    });
}

if (error.code === "LOT_NOT_FOUND") {
    return res.status(404).json({ success: false, message: error.message || "Parking lot not found" });
}
```

- [ ] **Step 5: Run targeted backend tests**

Run: `npx jest __tests__/controllers/employee.sessions.rfid.controller.test.js`
Expected: PASS

Run: `npx jest __tests__/controllers/employee.sessions.controller.test.js`
Expected: PASS (no regression)

- [ ] **Step 6: Commit controller and tests**

```bash
git add be/controllers/employee.sessions.controller.js be/__tests__/controllers/employee.sessions.rfid.controller.test.js
git commit -m "feat(checkin): add dedicated RFID employee check-in controller"
```

### Task 3: Frontend API contract for RFID endpoint

**Files:**
- Modify: `fe/app/api/employee.client.js`
- Create: `fe/__tests__/api/employee.client.test.js`

- [ ] **Step 1: Write failing API client tests for new RFID method**

```js
import { checkInByRfid } from "@/app/api/employee.client";

it("calls /employee/parking/entry/rfid with payload", async () => {
    api.post.mockResolvedValue({ data: { success: true, ticket: { session_id: 101 } } });
    const payload = { card_uid: "CARD-001", vehicle_type: "car", entry_lane_id: "L1" };

    const result = await checkInByRfid(payload);

    expect(api.post).toHaveBeenCalledWith("/employee/parking/entry/rfid", payload);
    expect(result).toEqual({ success: true, ticket: { session_id: 101 } });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/api/employee.client.test.js -t "calls /employee/parking/entry/rfid with payload"`
Expected: FAIL (`checkInByRfid` not exported)

- [ ] **Step 3: Add `checkInByRfid` API method**

```js
export async function checkInByRfid(sessionData) {
    const res = await api.post("/employee/parking/entry/rfid", sessionData);
    return res.data;
}
```

- [ ] **Step 4: Add API error-propagation test**

```js
it("rethrows axios errors for caller-level state mapping", async () => {
    api.post.mockRejectedValue({ response: { status: 409, data: { message: "This vehicle already has an active session" } } });
    await expect(checkInByRfid({ card_uid: "CARD-001", vehicle_type: "car" })).rejects.toEqual(
        expect.objectContaining({ response: expect.objectContaining({ status: 409 }) })
    );
});
```

- [ ] **Step 5: Run frontend API tests**

Run: `npx jest __tests__/api/employee.client.test.js`
Expected: PASS

- [ ] **Step 6: Commit API client contract**

```bash
git add fe/app/api/employee.client.js fe/__tests__/api/employee.client.test.js
git commit -m "feat(fe-api): add RFID check-in client for dedicated endpoint"
```

### Task 4: Kiosk module registry + feature flags

**Files:**
- Create: `fe/app/employee/checkin/rfid/flags.js`
- Create: `fe/app/employee/checkin/rfid/state.js`
- Create: `fe/app/employee/checkin/rfid/modules.js`
- Create: `fe/__tests__/employee/rfid-kiosk.flags.test.js`

- [ ] **Step 1: Write failing tests for env flag parsing and required-module safety**

```js
import { getKioskFlags, isModuleEnabled } from "@/app/employee/checkin/rfid/flags";

it("defaults required modules to enabled", () => {
    const flags = getKioskFlags({});
    expect(flags.READER).toBe(true);
    expect(flags.VEHICLE_FORM).toBe(true);
    expect(flags.RESULT).toBe(true);
});

it("parses explicit false string as disabled", () => {
    const flags = getKioskFlags({ NEXT_PUBLIC_KIOSK_MODULE_RECENT_EVENTS: "false" });
    expect(flags.RECENT_EVENTS).toBe(false);
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx jest __tests__/employee/rfid-kiosk.flags.test.js`
Expected: FAIL (module files missing)

- [ ] **Step 3: Implement flags and state mapping utilities**

```js
export const KIOSK_STATES = {
    IDLE: "idle",
    SCANNING: "scanning",
    SUCCESS: "success",
    DENIED: "denied",
    ERROR: "error",
};

export function mapStatusToKioskState(status) {
    if (status === 201) return KIOSK_STATES.SUCCESS;
    if (status === 409) return KIOSK_STATES.DENIED;
    return KIOSK_STATES.ERROR;
}
```

```js
const readBool = (raw, fallback) => {
    if (raw === undefined) return fallback;
    return String(raw).toLowerCase() === "true";
};

export function getKioskFlags(env = process.env) {
    return {
        READER: readBool(env.NEXT_PUBLIC_KIOSK_MODULE_READER, true),
        VEHICLE_FORM: readBool(env.NEXT_PUBLIC_KIOSK_MODULE_VEHICLE_FORM, true),
        RESULT: readBool(env.NEXT_PUBLIC_KIOSK_MODULE_RESULT, true),
        GATE_STATUS: readBool(env.NEXT_PUBLIC_KIOSK_MODULE_GATE_STATUS, true),
        RECENT_EVENTS: readBool(env.NEXT_PUBLIC_KIOSK_MODULE_RECENT_EVENTS, false),
    };
}
```

- [ ] **Step 4: Implement module registry contract**

```js
export const REQUIRED_MODULES = ["READER", "VEHICLE_FORM", "RESULT"];

export function buildModuleRegistry(flags, components) {
    return [
        { id: "READER", order: 1, required: true, enabled: !!flags.READER, Component: components.ReaderPanel },
        { id: "VEHICLE_FORM", order: 2, required: true, enabled: !!flags.VEHICLE_FORM, Component: components.VehicleFormPanel },
        { id: "RESULT", order: 3, required: true, enabled: !!flags.RESULT, Component: components.ResultPanel },
        { id: "GATE_STATUS", order: 4, required: false, enabled: !!flags.GATE_STATUS, Component: components.GateStatusPanel },
        { id: "RECENT_EVENTS", order: 5, required: false, enabled: !!flags.RECENT_EVENTS, Component: components.RecentEventsPanel },
    ];
}
```

- [ ] **Step 5: Run flag tests**

Run: `npx jest __tests__/employee/rfid-kiosk.flags.test.js`
Expected: PASS

- [ ] **Step 6: Commit kiosk configuration foundation**

```bash
git add fe/app/employee/checkin/rfid/flags.js fe/app/employee/checkin/rfid/state.js fe/app/employee/checkin/rfid/modules.js fe/__tests__/employee/rfid-kiosk.flags.test.js
git commit -m "feat(kiosk): add RFID module flags and registry foundation"
```

### Task 5: Build kiosk page + modular panels + click-through states

**Files:**
- Create: `fe/app/employee/checkin/rfid/page.jsx`
- Create: `fe/app/employee/checkin/rfid/components/ReaderPanel.jsx`
- Create: `fe/app/employee/checkin/rfid/components/VehicleFormPanel.jsx`
- Create: `fe/app/employee/checkin/rfid/components/ResultPanel.jsx`
- Create: `fe/app/employee/checkin/rfid/components/GateStatusPanel.jsx`
- Create: `fe/app/employee/checkin/rfid/components/RecentEventsPanel.jsx`
- Create: `fe/__tests__/employee/rfid-kiosk.page.test.js`

- [ ] **Step 1: Write failing page test for state mapping with real API statuses**

```js
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import RfidKioskPage from "@/app/employee/checkin/rfid/page";

jest.mock("@/app/api/employee.client", () => ({
    checkInByRfid: jest.fn(),
}));

it("shows denied state when API returns 409", async () => {
    checkInByRfid.mockRejectedValue({ response: { status: 409, data: { message: "This vehicle already has an active session" } } });
    render(<RfidKioskPage />);
    fireEvent.change(screen.getByLabelText(/card uid/i), { target: { value: "CARD-001" } });
    fireEvent.click(screen.getByRole("button", { name: /check in/i }));
    await waitFor(() => expect(screen.getByText(/denied/i)).toBeInTheDocument());
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx jest __tests__/employee/rfid-kiosk.page.test.js -t "shows denied state when API returns 409"`
Expected: FAIL (page not implemented)

- [ ] **Step 3: Implement modular kiosk panels with clear single responsibility**

```jsx
// ReaderPanel.jsx
export default function ReaderPanel({ cardUid, onCardUidChange, disabled }) {
    return (
        <section className="rounded-xl bg-white p-6 shadow-sm border border-slate-200">
            <label className="block text-sm font-semibold text-slate-700" htmlFor="rfid-card-uid">Card UID</label>
            <input id="rfid-card-uid" value={cardUid} onChange={(e) => onCardUidChange(e.target.value)} disabled={disabled} className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3" />
        </section>
    );
}
```

```jsx
// ResultPanel.jsx
export default function ResultPanel({ status, message, ticket, onReset }) {
    return (
        <section>
            <h2 className="text-xl font-semibold">Result</h2>
            <p className="mt-2">State: {status}</p>
            <p>{message || "-"}</p>
            {ticket?.session_id ? <p>Session: {ticket.session_id}</p> : null}
            <button type="button" onClick={onReset}>Reset</button>
        </section>
    );
}
```

- [ ] **Step 4: Implement page orchestration with state machine and required-module safe-fail**

```jsx
const flags = getKioskFlags();
const registry = buildModuleRegistry(flags, panelComponents);
const missingRequired = registry.some((m) => m.required && !m.enabled);

if (missingRequired) {
    return <div className="p-6 text-red-700">Kiosk configuration error: required module disabled</div>;
}

const handleSubmit = async () => {
    setKioskState(KIOSK_STATES.SCANNING);
    try {
        const res = await checkInByRfid(payload);
        setTicket(res.ticket || null);
        setKioskState(KIOSK_STATES.SUCCESS);
    } catch (error) {
        const status = error.response?.status;
        setKioskState(mapStatusToKioskState(status));
        setResultMessage(error.response?.data?.message || "Failed to process RFID check-in");
    }
};
```

- [ ] **Step 5: Expand tests for success + error + module toggle rendering**

```js
it("shows success state with session id when API returns success", async () => {
    checkInByRfid.mockResolvedValue({ success: true, ticket: { session_id: 5001, time_in: "2026-04-27T10:00:00.000Z" } });
    // submit flow assertions
});

it("shows configuration error when required module is disabled", async () => {
    process.env.NEXT_PUBLIC_KIOSK_MODULE_READER = "false";
    // render and assert safe-fail message
});
```

- [ ] **Step 6: Run frontend page tests**

Run: `npx jest __tests__/employee/rfid-kiosk.page.test.js`
Expected: PASS

- [ ] **Step 7: Commit kiosk page and modules**

```bash
git add fe/app/employee/checkin/rfid fe/__tests__/employee/rfid-kiosk.page.test.js
git commit -m "feat(kiosk): add modular RFID check-in kiosk page with state mapping"
```

### Task 6: Navigation and environment documentation

**Files:**
- Modify: `fe/app/components/employee/Sidebar.jsx`
- Modify: `.env.example`

- [ ] **Step 1: Write failing assertion for sidebar kiosk entry (lightweight render test)**

```js
it("includes RFID Kiosk navigation item", () => {
    // render Sidebar with /employee path and assert link text/href
});
```

- [ ] **Step 2: Add sidebar navigation item under employee menu**

```jsx
{
    name: "RFID Kiosk",
    href: "/employee/checkin/rfid",
    icon: <HiOutlineLightningBolt className="mr-3 h-6 w-6" />,
}
```

- [ ] **Step 3: Add backend/FE env examples for deployment clarity**

```env
# RFID Check-in feature toggle (backend)
RFID_CHECKIN_ENABLED=true

# RFID kiosk module toggles (frontend build-time)
NEXT_PUBLIC_KIOSK_MODULE_READER=true
NEXT_PUBLIC_KIOSK_MODULE_VEHICLE_FORM=true
NEXT_PUBLIC_KIOSK_MODULE_RESULT=true
NEXT_PUBLIC_KIOSK_MODULE_GATE_STATUS=true
NEXT_PUBLIC_KIOSK_MODULE_RECENT_EVENTS=false
```

- [ ] **Step 4: Run focused FE test and smoke build checks**

Run: `npx jest __tests__/employee/rfid-kiosk.page.test.js __tests__/employee/rfid-kiosk.flags.test.js`
Expected: PASS

Run: `npm run build`
Expected: PASS (Next.js production build succeeds)

- [ ] **Step 5: Commit navigation + docs updates**

```bash
git add fe/app/components/employee/Sidebar.jsx .env.example
git commit -m "chore(kiosk): expose RFID kiosk route and document feature flags"
```

### Task 7: Final verification before PR

**Files:**
- Modify: none (verification only)
- Test: `be/__tests__/controllers/employee.sessions.rfid.controller.test.js`
- Test: `fe/__tests__/api/employee.client.test.js`
- Test: `fe/__tests__/employee/rfid-kiosk.page.test.js`

- [ ] **Step 1: Run backend targeted suite for RFID path**

Run: `npx jest __tests__/controllers/employee.sessions.rfid.controller.test.js __tests__/controllers/employee.sessions.controller.test.js`
Expected: PASS

- [ ] **Step 2: Run frontend targeted suite for RFID flow**

Run: `npx jest __tests__/api/employee.client.test.js __tests__/employee/rfid-kiosk.flags.test.js __tests__/employee/rfid-kiosk.page.test.js`
Expected: PASS

- [ ] **Step 3: Run nearest full suites for touched projects**

Run: `npm test` (from `be/`)
Expected: PASS

Run: `npm test` (from `fe/`)
Expected: PASS

- [ ] **Step 4: Capture verification evidence in PR notes**

```md
- Backend: `npm test` PASS
- Frontend: `npm test` PASS
- Build: `npm run build` PASS
- Manual: `/employee/checkin/rfid` idle -> scanning -> success/denied/error validated
```

- [ ] **Step 5: Final commit (if verification required small fixes)**

```bash
git add .
git commit -m "test(kiosk): finalize RFID check-in verification adjustments"
```

## Self-Review

### 1) Spec coverage

- Dedicated RFID endpoint: covered in Tasks 1-2.
- Real BE + DB-aligned logic: covered in Task 2 (reuse `startSession` + error mapping).
- Modular FE with env toggles: covered in Tasks 4-5.
- Click-through kiosk states: covered in Task 5.
- Required-module safe-fail behavior: covered in Tasks 4-5.
- Sidebar exposure + env documentation: covered in Task 6.
- Testing expectations (targeted then full): covered in Task 7.

No uncovered requirement found.

### 2) Placeholder scan

- Removed vague items; every task includes concrete files, code snippets, and exact commands.
- No `TODO`/`TBD` placeholders remain.

### 3) Type/signature consistency

- Backend method name is consistently `checkInByRfid`.
- Frontend API method name is consistently `checkInByRfid`.
- State constants use one set: `idle/scanning/success/denied/error`.
- Feature flag names are consistent across plan and docs.
