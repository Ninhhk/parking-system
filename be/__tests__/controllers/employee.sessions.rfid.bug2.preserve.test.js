/**
 * Preservation tests for Bug 2 (RFID check-in always is_monthly: false).
 *
 * These tests run against the UNFIXED checkInByRfid to establish a baseline
 * of correct behaviors that must be preserved after the fix is applied.
 *
 * All three tests MUST PASS on unfixed code.
 */

const createResponse = () => ({
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
});

const loadControllerWithFlag = (rfidEnabled) => {
    jest.resetModules();
    jest.doMock("../../config/constants", () => ({
        RFID_CHECKIN_ENABLED: rfidEnabled,
        LICENSE_PLATE_REGEX: /^[A-Z0-9-]+$/i,
        VALID_PAYMENT_METHODS: ["CASH", "CARD"],
        VALID_VEHICLE_TYPES: ["car", "bike"],
    }));

    const sessionsRepo = {
        startSession: jest.fn(),
        checkMonthlySubByCard: jest.fn(),
    };

    const lotsRepo = {
        getParkingLotByManager: jest.fn(),
        getAllParkingLots: jest.fn(),
    };

    jest.doMock("../../repositories/employee.sessions.repo", () => sessionsRepo);
    jest.doMock("../../repositories/admin.lots.repo", () => lotsRepo);

    const controller = require("../../controllers/employee.sessions.controller");
    return { controller, sessionsRepo, lotsRepo };
};

describe("employee.sessions.controller checkInByRfid — Bug 2 preservation (unfixed code)", () => {
    /**
     * Preservation 1: Card with no active subscription → is_monthly: false
     *
     * The unfixed code hardcodes is_monthly: false, which happens to be the
     * correct result for a card with no subscription. This behavior must be
     * preserved after the fix.
     */
    it("card with no active subscription passes is_monthly: false to startSession and returns 201", async () => {
        const { controller, sessionsRepo, lotsRepo } = loadControllerWithFlag(true);

        const req = {
            body: {
                card_uid: "CARD-NO-SUB",
                vehicle_type: "car",
            },
            session: {
                user: { user_id: 10 },
            },
        };
        const res = createResponse();

        lotsRepo.getParkingLotByManager.mockResolvedValue({ lot_id: 1, lot_name: "Lot 1" });
        sessionsRepo.checkMonthlySubByCard.mockResolvedValue(undefined);
        sessionsRepo.startSession.mockResolvedValue({
            session_id: 100,
            license_plate: null,
            vehicle_type: "car",
            time_in: "2026-04-27T09:00:00.000Z",
            is_monthly: false,
            lot_id: 1,
        });

        await controller.checkInByRfid(req, res);

        expect(sessionsRepo.startSession).toHaveBeenCalledWith(
            expect.objectContaining({ is_monthly: false })
        );
        expect(res.status).toHaveBeenCalledWith(201);
    });

    /**
     * Preservation 2: RFID_CHECKIN_ENABLED = false → 503
     *
     * The feature-flag guard must remain intact after the fix.
     */
    it("returns 503 when RFID_CHECKIN_ENABLED is false", async () => {
        const { controller, sessionsRepo } = loadControllerWithFlag(false);

        const req = {
            body: {
                card_uid: "CARD-ANY",
                vehicle_type: "car",
            },
            session: {
                user: { user_id: 10 },
            },
        };
        const res = createResponse();

        await controller.checkInByRfid(req, res);

        expect(res.status).toHaveBeenCalledWith(503);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            message: "RFID check-in is currently disabled",
        });
        expect(sessionsRepo.startSession).not.toHaveBeenCalled();
    });

    /**
     * Preservation 3: Missing card_uid → 422
     *
     * Input validation must remain intact after the fix.
     */
    it("returns 422 when card_uid is missing", async () => {
        const { controller, sessionsRepo } = loadControllerWithFlag(true);

        const req = {
            body: {
                vehicle_type: "car",
            },
            session: {
                user: { user_id: 10 },
            },
        };
        const res = createResponse();

        await controller.checkInByRfid(req, res);

        expect(res.status).toHaveBeenCalledWith(422);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            message: "Missing required fields",
        });
        expect(sessionsRepo.startSession).not.toHaveBeenCalled();
    });
});
