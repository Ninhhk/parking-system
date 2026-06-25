import api from "./client.config";

export async function fetchMyLot() {
    const res = await api.get("/employee/monitor");
    return res.data.data;
}

// Check-in a vehicle (Entry API)
export async function checkInVehicle(sessionData) {
    const res = await api.post("/employee/parking/entry", sessionData);
    return res.data;
}

export async function checkInByRfid(sessionData) {
    const res = await api.post("/employee/parking/entry/rfid", sessionData);
    return res.data;
}

// Resolve the active session bound to a tapped card for checkout (Exit by card)
export async function findActiveSessionByCard(cardUid) {
    const res = await api.get(`/employee/parking/exit/by-card/${cardUid}`);
    return res.data.data;
}

// Initiate check-out process (Exit Stage 1) - Just gets preliminary information, no DB updates
export async function initiateCheckout(sessionId) {    const res = await api.get(`/employee/parking/exit/${sessionId}`);
    return res;
}

// Confirm payment and complete check-out (Exit Stage 2) - Creates payment record and updates session
export async function confirmCheckout(sessionId, paymentMethod, imageOutBase64) {
    const res = await api.post("/employee/parking/exit/confirm", {
        session_id: sessionId,
        payment_method: paymentMethod,
        image_out_base64: imageOutBase64 || undefined,
    });
    return res.data;
}

// One-tap monthly/subscription checkout: finalizes a fee-waived monthly session
// directly (no QR, no cash) and stores the exit image. Server re-validates that the
// session is monthly and owes nothing before finalizing.
export async function confirmMonthlyCheckout(sessionId, imageOutBase64) {
    const res = await api.post(`/employee/parking/exit/${sessionId}/monthly-checkout`, {
        image_out_base64: imageOutBase64 || undefined,
    });
    return res.data;
}

// Upload the exit image for a CARD/QR checkout finalized server-side by the webhook.
// The webhook cannot access the operator's live camera, so the browser uploads it here.
export async function uploadExitImage(sessionId, imageOutBase64) {
    const res = await api.post(`/employee/parking/exit/${sessionId}/exit-image`, {
        image_out_base64: imageOutBase64,
    });
    return res.data;
}

export async function createPaymentIntent(sessionId, idempotencyKey, amount) {
    const res = await api.post(`/employee/parking/exit/${sessionId}/payment-intents`, {
        payment_method: "CARD",
        idempotency_key: idempotencyKey,
        ...(Number.isFinite(amount) ? { amount } : {}),
    });
    return res.data.data;
}

export async function regeneratePaymentIntent(sessionId, idempotencyKey, amount) {
    const res = await api.post(`/employee/parking/exit/${sessionId}/payment-intents/regenerate`, {
        idempotency_key: idempotencyKey,
        force_new: true,
        ...(Number.isFinite(amount) ? { amount } : {}),
    });
    return res.data.data;
}

export async function fetchPaymentStatus(sessionId) {
    const res = await api.get(`/employee/parking/exit/${sessionId}/payment-status`);
    return res.data.data;
}

// Report a lost ticket (employee)
export async function reportLostTicket({ session_id, guest_identification, guest_phone }) {
    const res = await api.post("/employee/lost-tickets", {
        session_id,
        guest_identification,
        guest_phone,
    });
    return res.data;
}

// Fetch currently parked (active) vehicles for the employee's lot
export async function fetchActiveVehicles({ plate, vehicleType, page = 1, pageSize = 20 } = {}) {
    const params = { status: "active", page, pageSize };
    if (plate) params.plate = plate;
    if (vehicleType) params.vehicleType = vehicleType;
    const res = await api.get("/employee/audit/sessions", { params });
    return res.data.data;
}

// Fetch user profile
export async function fetchMyProfile() {
    const res = await api.get("/employee/profile");
    return res.data; // Adjusted to return res.data directly
}

// Update user profile (currently only supports password change)
export async function updateMyProfile(profileData) {
    const res = await api.put("/employee/profile", profileData);
    return res.data;
}

export async function deleteLostTicket(session_id) {
    const res = await api.delete(`/employee/lost-tickets/${session_id}`);
    return res.data;
}

// Fetch lane configuration for the unified check-in kiosk
export async function getGatewayLaneConfig(laneId) {
    const res = await api.get(`/employee/gateway-config/${laneId}`);
    return res.data.data;
}

// Look up active subscription by RFID card UID
export async function getSubscriptionByCard(cardUid) {
    const res = await api.get(`/employee/subscription/by-card/${cardUid}`);
    return res.data.data;
}
