import api from "./client.config";

export async function fetchHomePage() {
    const res = await api.get("/employee");
    return res.data.data;
}

export async function fetchMyLot() {
    const res = await api.get("/employee/monitor");
    return res.data.data;
}

export async function fetchMyParkingSessions() {
    const res = await api.get("/employee/monitor/sessions");
    return res.data.data;
}

// Get parking lots for the employee
export async function fetchParkingLots() {
    const res = await api.get("/employee/parking-lots");
    return res.data.data;
}

// Get active parking sessions for the employee's lot
export async function fetchActiveSessions() {
    const res = await api.get("/employee/parking-sessions");
    return res.data.data;
}

// Check-in a vehicle (Entry API)
export async function checkInVehicle(sessionData) {
    const res = await api.post("/employee/parking/entry", sessionData);
    return res.data;
}

// Initiate check-out process (Exit Stage 1) - Just gets preliminary information, no DB updates
export async function initiateCheckout(sessionId) {
    const res = await api.get(`/employee/parking/exit/${sessionId}`);
    return res;
}

// Confirm payment and complete check-out (Exit Stage 2) - Creates payment record and updates session
export async function confirmCheckout(sessionId, paymentMethod) {
    const res = await api.post("/employee/parking/exit/confirm", {
        session_id: sessionId,
        payment_method: paymentMethod,
    });
    return res.data;
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
