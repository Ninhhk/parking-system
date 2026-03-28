import api from "./client.config";

const normalizeError = (error, fallbackMessage) => {
    const message =
        error?.response?.data?.message ||
        (typeof error?.response?.data === "string" ? error.response.data : null) ||
        error?.message ||
        fallbackMessage;

    return new Error(message);
};

export const login = async (credentials) => {
    try {
        const response = await api.post("/auth/login", credentials);
        return response.data.data;
    } catch (error) {
        throw normalizeError(error, "Login failed");
    }
};

export const register = async (data) => {
    try {
        const response = await api.post("/auth/register", data);
        return response.data.data;
    } catch (error) {
        throw normalizeError(error, "Registration failed");
    }
};

export const logout = async () => {
    try {
        await api.post("/auth/logout");
        window.location.href = "/";
    } catch (error) {
        throw normalizeError(error, "Logout failed");
    }
};
