const { getState, setState } = require("../../services/gate.state.service");

describe("gate.state.service", () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    describe("getState", () => {
        test("returns default CLOSED state for unknown lane", () => {
            const state = getState("unknown-lane-xyz");

            expect(state).toMatchObject({
                lane_id: "unknown-lane-xyz",
                status: "CLOSED",
                plate: "",
                message: "",
            });
            expect(state.updated_at).toBeDefined();
            expect(new Date(state.updated_at).toISOString()).toBe(state.updated_at);
        });
    });

    describe("setState", () => {
        test("stores state and getState retrieves it", () => {
            setState("lane-A", { status: "OPEN", plate: "29A-123", message: "Mời vào" });

            const state = getState("lane-A");

            expect(state).toMatchObject({
                lane_id: "lane-A",
                status: "OPEN",
                plate: "29A-123",
                message: "Mời vào",
            });
            expect(state.updated_at).toBeDefined();
        });

        test("returns the state object", () => {
            const result = setState("lane-B", { status: "OPEN", plate: "30B-456", message: "Tạm biệt" });

            expect(result).toMatchObject({
                lane_id: "lane-B",
                status: "OPEN",
                plate: "30B-456",
                message: "Tạm biệt",
            });
        });

        test("defaults plate and message to empty string when not provided", () => {
            const result = setState("lane-C", { status: "OPEN" });

            expect(result.plate).toBe("");
            expect(result.message).toBe("");
        });
    });

    describe("auto-reset after 5 seconds", () => {
        test("state reverts to CLOSED after 5000ms", () => {
            setState("lane-reset", { status: "OPEN", plate: "51G-789", message: "Mời vào" });

            expect(getState("lane-reset").status).toBe("OPEN");

            jest.advanceTimersByTime(5000);

            const state = getState("lane-reset");
            expect(state.status).toBe("CLOSED");
            expect(state.plate).toBe("");
            expect(state.message).toBe("");
        });

        test("state remains OPEN before 5000ms", () => {
            setState("lane-timing", { status: "OPEN", plate: "ABC", message: "Mời vào" });

            jest.advanceTimersByTime(4999);

            expect(getState("lane-timing").status).toBe("OPEN");
        });
    });

    describe("multiple setState on same lane", () => {
        test("last call wins, earlier timer is cleared", () => {
            setState("lane-multi", { status: "OPEN", plate: "FIRST", message: "Mời vào" });

            jest.advanceTimersByTime(3000);

            setState("lane-multi", { status: "OPEN", plate: "SECOND", message: "Tạm biệt" });

            // After 2000ms more (5000 from first call), should NOT reset
            // because first timer was cleared
            jest.advanceTimersByTime(2000);

            const state = getState("lane-multi");
            expect(state.status).toBe("OPEN");
            expect(state.plate).toBe("SECOND");

            // After 3000ms more (5000 from second call), resets
            jest.advanceTimersByTime(3000);

            expect(getState("lane-multi").status).toBe("CLOSED");
        });
    });

    describe("lane independence", () => {
        test("different lanes are independent", () => {
            setState("lane-X", { status: "OPEN", plate: "X-PLATE", message: "Mời vào" });
            setState("lane-Y", { status: "OPEN", plate: "Y-PLATE", message: "Tạm biệt" });

            expect(getState("lane-X").plate).toBe("X-PLATE");
            expect(getState("lane-Y").plate).toBe("Y-PLATE");

            // Reset lane-X timer
            jest.advanceTimersByTime(5000);

            expect(getState("lane-X").status).toBe("CLOSED");
            expect(getState("lane-Y").status).toBe("CLOSED");
        });
    });

    /**
     * Property 5: Successful entry event sets gate state to OPEN with entry message
     * Validates: Requirements 4.4
     */
    describe("Property 5 – entry event sets OPEN with entry message", () => {
        test("setState with entry message produces correct state", () => {
            const plate = "29A-12345";
            setState("lane-entry", { status: "OPEN", plate, message: "Mời vào" });

            const state = getState("lane-entry");
            expect(state.status).toBe("OPEN");
            expect(state.plate).toBe(plate);
            expect(state.message).toBe("Mời vào");
        });
    });

    /**
     * Property 6: Successful exit event sets gate state to OPEN with exit message
     * Validates: Requirements 4.5
     */
    describe("Property 6 – exit event sets OPEN with exit message", () => {
        test("setState with exit message produces correct state", () => {
            const plate = "51G-99999";
            setState("lane-exit", { status: "OPEN", plate, message: "Tạm biệt" });

            const state = getState("lane-exit");
            expect(state.status).toBe("OPEN");
            expect(state.plate).toBe(plate);
            expect(state.message).toBe("Tạm biệt");
        });
    });
});
