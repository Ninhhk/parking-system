/**
 * Unit tests for admin.lots.controller — updateParkingLot casual_entry_mode validation.
 *
 * Covers the casual_entry_mode selector wiring from the lot edit form:
 *  - an invalid value is rejected with 422 and is NOT persisted (no repo write)
 *  - a valid value is forwarded to the repo and persisted (200)
 *  - an absent value is allowed (repo COALESCEs it, keeping the current value)
 *
 * Validates: Requirements 6.2, 6.3
 */

const lotsRepo = require("../../repositories/admin.lots.repo");
const controller = require("../../controllers/admin.lots.controller");

jest.mock("../../repositories/admin.lots.repo");

const createResponse = () => ({
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
});

const baseBody = {
    lot_name: "Lot A",
    car_capacity: 100,
    bike_capacity: 50,
    managed_by: 3,
};

describe("admin.lots.controller — updateParkingLot casual_entry_mode", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    /**
     * Req 6.3 — invalid casual_entry_mode → 422 and no write.
     */
    it("rejects an invalid casual_entry_mode with 422 and does not call the repo", async () => {
        const req = {
            params: { id: "1" },
            body: { ...baseBody, casual_entry_mode: "turnstile" },
        };
        const res = createResponse();

        await controller.updateParkingLot(req, res);

        expect(res.status).toHaveBeenCalledWith(422);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            message: "Invalid casual entry mode",
        });
        expect(lotsRepo.updateParkingLot).not.toHaveBeenCalled();
    });

    /**
     * Req 6.2 — valid casual_entry_mode is forwarded to the repo and persisted (200).
     */
    it.each(["session_ticket", "issued_card"])(
        "persists the valid casual_entry_mode '%s' via the repo and returns 200",
        async (mode) => {
            const updatedLot = { lot_id: 1, ...baseBody, casual_entry_mode: mode };
            lotsRepo.updateParkingLot.mockResolvedValue(updatedLot);

            const req = {
                params: { id: "1" },
                body: { ...baseBody, casual_entry_mode: mode },
            };
            const res = createResponse();

            await controller.updateParkingLot(req, res);

            expect(lotsRepo.updateParkingLot).toHaveBeenCalledWith("1", {
                ...baseBody,
                casual_entry_mode: mode,
            });
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith({ success: true, data: updatedLot });
            expect(res.json.mock.calls[0][0].data.casual_entry_mode).toBe(mode);
        }
    );

    /**
     * Req 6.2 — absent casual_entry_mode is allowed; controller forwards undefined so the
     * repo COALESCE keeps the lot's current value.
     */
    it("allows an absent casual_entry_mode and forwards undefined to the repo (200)", async () => {
        const updatedLot = { lot_id: 1, ...baseBody, casual_entry_mode: "session_ticket" };
        lotsRepo.updateParkingLot.mockResolvedValue(updatedLot);

        const req = { params: { id: "1" }, body: { ...baseBody } };
        const res = createResponse();

        await controller.updateParkingLot(req, res);

        expect(lotsRepo.updateParkingLot).toHaveBeenCalledWith("1", {
            ...baseBody,
            casual_entry_mode: undefined,
        });
        expect(res.status).toHaveBeenCalledWith(200);
    });
});
