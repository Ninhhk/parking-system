import { serverApiFetch } from "./server.config";

// SSR: Get current user (any role)
export async function fetchCurrentUserSSR() {
    const res = await serverApiFetch("/auth/me");
    if (!res.ok) return null;
    const data = await res.json();
    return data.data.user;
}
