import api from "./client.config";

const hasValue = (value) => String(value ?? "").trim().length > 0;

function compactParams(params = {}) {
    return Object.entries(params).reduce((acc, [key, value]) => {
        if (value === null || value === undefined) {
            return acc;
        }
        if (typeof value === "string" && !hasValue(value)) {
            return acc;
        }
        acc[key] = value;
        return acc;
    }, {});
}

export async function fetchEdgeEvents(params = {}) {
    const res = await api.get("/edge/events", {
        params: compactParams(params),
    });
    return res.data.data;
}

export async function fetchEdgeEventDetail(eventId) {
    const res = await api.get(`/edge/events/${eventId}`);
    return res.data.data;
}

export async function retryEdgeEvent(eventId) {
    const res = await api.post(`/edge/events/${eventId}/retry`);
    return res.data.data;
}

export async function fetchEdgeActiveSessions(params = {}) {
    const res = await api.get("/edge/sessions/active", {
        params: compactParams(params),
    });
    return res.data.data;
}
