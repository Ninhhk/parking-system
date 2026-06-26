import api from "./client.config";

// Fetch gate settings (admin)
export async function fetchGateSettings() {
    const res = await api.get("/admin/gate-settings");
    return res.data.data;
}

// Update gate settings (admin only)
export async function updateGateSettings({ auto_close_duration_seconds, kiosk_input_reset_seconds }) {
    const res = await api.put("/admin/gate-settings", {
        auto_close_duration_seconds,
        kiosk_input_reset_seconds,
    });
    return res.data.data;
}

// Fetch gate settings (employee/operator pages)
export async function fetchEmployeeGateSettings() {
    const res = await api.get("/employee/gate-settings");
    return res.data.data;
}
