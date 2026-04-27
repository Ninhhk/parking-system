import {
    fetchEdgeEvents,
    fetchEdgeEventDetail,
    retryEdgeEvent,
    fetchEdgeActiveSessions,
} from "@/app/api/edge.client";

jest.mock("@/app/api/client.config", () => ({
    get: jest.fn(),
    post: jest.fn(),
}));

import api from "@/app/api/client.config";

describe("edge client contract", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("fetchEdgeEvents calls list endpoint with query params", async () => {
        const payload = { rows: [{ event_id: "evt-1" }] };
        api.get.mockResolvedValue({ data: { data: payload } });

        const result = await fetchEdgeEvents({ status: "FAILED", lane: "A1", page: 2 });

        expect(api.get).toHaveBeenCalledWith("/edge/events", {
            params: { status: "FAILED", lane: "A1", page: 2 },
        });
        expect(result).toEqual(payload);
    });

    it("fetchEdgeEventDetail calls detail endpoint", async () => {
        const payload = { event_id: "evt-9" };
        api.get.mockResolvedValue({ data: { data: payload } });

        const result = await fetchEdgeEventDetail("evt-9");

        expect(api.get).toHaveBeenCalledWith("/edge/events/evt-9");
        expect(result).toEqual(payload);
    });

    it("retryEdgeEvent calls retry endpoint", async () => {
        const payload = { status: "SUCCESS" };
        api.post.mockResolvedValue({ data: { data: payload } });

        const result = await retryEdgeEvent("evt-2");

        expect(api.post).toHaveBeenCalledWith("/edge/events/evt-2/retry");
        expect(result).toEqual(payload);
    });

    it("fetchEdgeActiveSessions calls sessions endpoint with params", async () => {
        const payload = { rows: [{ session_id: 11 }] };
        api.get.mockResolvedValue({ data: { data: payload } });

        const result = await fetchEdgeActiveSessions({ laneId: "A1", q: "51G", page: 1 });

        expect(api.get).toHaveBeenCalledWith("/edge/sessions/active", {
            params: { laneId: "A1", q: "51G", page: 1 },
        });
        expect(result).toEqual(payload);
    });
});
