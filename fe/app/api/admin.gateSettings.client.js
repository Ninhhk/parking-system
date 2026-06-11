import api from "./client.config";

// Fetch gate settings (admin)
export async function fetchGateSettings() {
    const res = await api.get("/admin/gate-settings");
    return res.data.data;
}

// Update gate auto-close duration (admin only)
export async function updateGateSettings(durationSeconds) {
    const res = await api.put("/admin/gate-settings", {
        auto_close_duration_seconds: durationSeconds,
    });
    return res.data.data;
}

// Fetch gate settings (employee/operator pages)
export async function fetchEmployeeGateSettings() {
    const res = await api.get("/employee/gate-settings");
    return res.data.data;
}
