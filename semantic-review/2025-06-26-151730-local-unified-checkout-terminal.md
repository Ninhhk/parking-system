# Unified checkout terminal + check-in kiosk hardening

This diff consolidates the checkout flow from a two-page architecture (card-scan page redirecting to a per-session `[sessionid]/page.jsx`) into a single-screen checkout terminal that resolves sessions in place. Alongside this, the check-in kiosk gains a frozen-frame display after successful capture and respects hold-mode during gate-close events. The backend picks up a new monthly-checkout endpoint and renames `confirmCashCheckout` to the broader `settleCheckout`.

Watch for:
- The checkout page is a 1350-line single component with no extraction — every state machine, timer, effect, and render branch lives in one function. Maintainability cliff. **(confirmed)**
- The monthly auto-finalize fires on an 800ms `setTimeout` to let the camera warm up — a timing heuristic that may misfire on cold starts or slow USB cameras. **(likely)**
- `window.location.reload()` in lost-ticket flows destroys gate state, camera stream, and hold-mode context in the new single-screen model. **(confirmed)**

## High-level view

The checkout terminal collapses two route-based screens into a single stateful page. It manages card-scan → session resolution → fee display → payment (cash hotkey, card/QR polling, monthly one-tap) → gate open → success overlay → reset, all without navigation. The old `[sessionid]/page.jsx` becomes a redirect stub.

The check-in kiosk receives two behavioral refinements: after a successful check-in, the live video feed is replaced by the captured frame (frozen-frame pattern), giving the operator visual confirmation of what was stored. Gate-close events throughout the kiosk now respect hold-mode — if the gate is being held open, error/denial paths no longer override it.

The `GateStatusPanel` gains a two-step confirmation before activating hold-mode, preventing accidental indefinite-open from a misclick.

On the backend, `confirmCashCheckout` is generalized to `settleCheckout` (accepting `CASH` and `MONTHLY`) and a new `confirmMonthlyCheckout` controller validates monthly eligibility server-side, ensuring a monthly session that still carries a penalty cannot bypass payment.

<details>
<summary>Issues (5)</summary>

1. **1350-line single component** — The checkout terminal page has no sub-component extraction. Extract at minimum the billing summary, payment method panel, and success overlay into focused components to keep the file reviewable.
2. **Race between `setSessionid` and in-flight requests** — When the operator switches sessions, the `useEffect` watching `sessionid` fires `initiateCheckout` for the new session, but in-flight requests from the previous session (card-polling interval, slow `initiateCheckout`) can resolve and stomp the freshly-loaded state. `isMountedRef` only guards unmount, not session-switch. Fix: per-session abort controller.
3. **`window.location.reload()` after lost-ticket report** — Breaks the single-screen terminal model by fully reloading the page, losing gate state, camera stream, and hold-mode context. Should re-fetch session data in place via `initiateCheckout(sessionid)`.
4. **Monthly auto-finalize 800ms heuristic** — If the camera isn't producing frames within 800ms, `captureExitImage()` returns null and the session finalizes without an exit frame. The operator gets no signal that the frame was missed.
5. **Stale closure in card-payment polling** — The `setInterval` callback captures `exitImage` at creation time. If the operator recaptures a frame between polls, the `PAID` handler uploads the old frame. Fix: read from a ref at upload time.

</details>

<details>
<summary>Details</summary>

## Checkout terminal state machine and session-switch race

The component manages a two-level state machine: an outer idle/loaded distinction driven by `sessionid` (null vs truthy), and an inner `viewState` (`input` → `processing` → `success` | `payment_failed`) for the loaded checkout. Session switching happens by setting `sessionid` directly — the `useEffect` on `[sessionid]` re-runs `initiateCheckout`.

When the operator scans a different card while a session is loaded, `handleScanCapture` resolves the new session and calls `setSessionid(newId)`. The `initiateCheckout` effect fires, but the card-payment polling interval (3s `setInterval`) from the old session may still be running — its cleanup depends on the effect's dependency array, which includes `sessionid`, so it will eventually re-create. However, between the state update and React re-rendering/re-running the effect, a poll iteration could fire and call `uploadExitImage` or `openGate` for the wrong session. A per-session abort controller (or a session-id check inside the interval callback) would close this window.

## Frozen-frame in check-in kiosk

The `KioskCameraPanel` accepts a `frozenFrame` prop (base64 data URL). When set, the live `<video>` element's opacity drops to 0 and an `<img>` renders on top. The live stream continues running underneath — `capture()` still works even while frozen, supporting recapture without restarting the stream. This is well-designed for the kiosk's "retry capture" workflow.

## Hold-mode gate semantics (`closeGateUnlessHold`)

The new `closeGateUnlessHold()` helper reads `gateContextRef.current` and no-ops if it's `"hold"`. Applied at six call sites in the check-in kiosk (resetKiosk, capture-failure, check-in error paths). Previously these all called `setGateState("shut")` unconditionally, overriding hold-mode.

In the checkout terminal, `openGate("checkout", detail)` also respects hold: when in hold mode, it skips the success overlay timer and immediately clears session state for the next vehicle while keeping the gate propped open. This means a held-open gate never shows the success modal — deliberate so the operator isn't blocked by an overlay while the next car arrives.

## `window.location.reload()` in lost-ticket flows

Both `handleLostTicketSubmit` (success path) and `handleRemoveLostTicket` call `window.location.reload()`. In the new single-screen terminal, this destroys: camera stream, gate state/timer, hold-mode context, BroadcastChannel to customer display, and any pending payment intent state. Replace with re-calling `initiateCheckout(sessionid)` to refresh the session data in place.

## Stale closure in card-payment polling

The 3-second polling `setInterval` captures `exitImage` at bind time. Its dependency array includes `paymentIntent?.attempt_id`, `sessionid`, and `checkout.session` — so it re-creates when the intent or session changes. But within a single session + intent lifecycle, if the operator recaptures the exit frame (updating `exitImage` state), the closure still holds the old value. When `PAID` fires, `uploadExitImage` sends the stale frame. Reading from a ref (`exitImageRef.current`) at upload time fixes this without adding `exitImage` to the deps (which would restart the interval and reset the polling cadence on every recapture).

## Monthly checkout backend endpoint

The new `POST /employee/parking/exit/:session_id/monthly-checkout` endpoint validates the session is monthly AND owes nothing (recalculates fees server-side) before finalizing. A monthly session still carrying a penalty (lost ticket) gets a 409 and must go through cash/card. Exit image is uploaded fire-and-forget after the response is sent.

## CORS `PATCH` addition

`be/app.js` adds `"PATCH"` to allowed methods. Presumably needed by an endpoint not shown in this diff. No security concern.

</details>

<details>
<summary>File map</summary>

| File | Change |
|------|--------|
| `fe/app/employee/checkout/page.jsx` | Full rewrite: single-screen checkout terminal (1351 lines) |
| `fe/app/employee/checkout/[sessionid]/page.jsx` | Gutted to a redirect stub |
| `fe/app/employee/checkin/page.jsx` | Added `frozenFrame` state + `closeGateUnlessHold` helper |
| `fe/app/employee/checkin/components/KioskCameraPanel.jsx` | New props: `frozenFrame`, `title`, `headerActions`; frozen-frame overlay |
| `fe/app/employee/checkin/components/GateStatusPanel.jsx` | Two-step hold confirmation |
| `be/controllers/employee.sessions.controller.js` | New `confirmMonthlyCheckout` endpoint |
| `be/services/checkout.service.js` | Rename `confirmCashCheckout` → `settleCheckout`, accept `MONTHLY` |
| `be/routes/employee.routes.js` | Route for monthly-checkout |
| `be/app.js` | Add `PATCH` to CORS allowed methods |
| `fe/app/api/employee.client.js` | New `confirmMonthlyCheckout` + `fetchActiveVehicles` client functions |
| `fe/app/api/employee.lpd.client.js` | Downgrade error log to `console.warn` |
| `fe/app/components/employee/Navbar.jsx` | Add "Vehicles" nav item |
| `be/__tests__/services/checkout.service.test.js` | Rename test to match `settleCheckout` |
| `fe/build_output.txt` | Deleted (artifact) |

Full diff: `git diff` (16 files, +1580 −1280)

</details>
