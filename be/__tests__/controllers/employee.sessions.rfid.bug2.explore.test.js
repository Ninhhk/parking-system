/**
 * Bug 2 Fix Verification — checkInByRfid now looks up subscription by card_uid
 *
 * This test runs against FIXED code to confirm the bug is resolved.
 * It asserts that startSession is called with is_monthly: true when the card
 * has an active monthly subscription.
 *
 * EXPECTED OUTCOME: PASSES (verifies the fix is in place).
 *
 * Validates: Requirements 2.1, 2.2
 */

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

const createResponse = () => ({
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
});

describe("Bug 2 fix verification — checkInByRfid looks up subscription by card_uid", () => {
    it("passes is_monthly: true to startSession when card has an active subscription", async () => {
        const { controller, sessionsRepo, lotsRepo } = loadControllerWithFlag(true);

        const req = {
            body: {
                card_uid: "CARD-001",
                vehicle_type: "car",
            },
            session: {
                user: { user_id: 1 },
            },
        };
        const res = createResponse();

        lotsRepo.getParkingLotByManager.mockResolvedValue({ lot_id: 10, lot_name: "Test Lot" });
        sessionsRepo.checkMonthlySubByCard.mockResolvedValue({
            sub_id: 42,
            card_uid: "CARD-001",
            vehicle_type: "car",
            start_date: "2026-01-01",
            end_date: "2026-12-31",
        });
        sessionsRepo.startSession.mockResolvedValue({
            session_id: 1,
            license_plate: null,
            vehicle_type: "car",
            time_in: "2026-01-01T08:00:00.000Z",
            is_monthly: true,
            lot_id: 10,
        });

        await controller.checkInByRfid(req, res);

        expect(sessionsRepo.checkMonthlySubByCard).toHaveBeenCalledTimes(1);
        expect(sessionsRepo.startSession).toHaveBeenCalledTimes(1);

        const payload = sessionsRepo.startSession.mock.calls[0][0];

        // FIX: is_monthly is now true because the subscription lookup found a row
        expect(payload.is_monthly).toBe(true);
    });
});
