import api from "./client.config";

// Fetch checkout settings (admin)
export async function fetchCheckoutSettings() {
    const res = await api.get("/admin/checkout-settings");
    return res.data.data;
}

// Update default payment method (admin only)
export async function updateCheckoutSettings(defaultPaymentMethod) {
    const res = await api.put("/admin/checkout-settings", {
        default_payment_method: defaultPaymentMethod,
    });
    return res.data.data;
}

// Fetch checkout settings (employee/operator pages)
export async function fetchEmployeeCheckoutSettings() {
    const res = await api.get("/employee/checkout-settings");
    return res.data.data;
}
