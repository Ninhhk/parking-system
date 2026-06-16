/**
 * Fix-checking unit tests for Bug 2 — checkInByRfid subscription lookup.
 *
 * Validates: Requirements 2.1, 2.2
 */

// --- Pool mock for repo tests (tests 3 & 4) ---
const mockPoolQuery = jest.fn();
jest.mock("../../config/db", () => ({
    pool: { query: (...args) => mockPoolQuery(...args) },
}));

const { checkMonthlySubByCard } = require("../../repositories/employee.sessions.repo");

// --- Controller tests (tests 1 & 2) ---
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

    const parkingCardsRepo = {
        getPoolCard: jest.fn().mockResolvedValue(null),
        markLost: jest.fn(),
    };
    jest.doMock("../../repositories/parkingCards.repo", () => parkingCardsRepo);

    const controller = require("../../controllers/employee.sessions.controller");
    return { controller, sessionsRepo, lotsRepo, parkingCardsRepo };
};

describe("Bug 2 fix — checkInByRfid controller", () => {
    it("calls startSession with is_monthly: true when card has an active subscription", async () => {
        const { controller, sessionsRepo, lotsRepo } = loadControllerWithFlag(true);

        const req = {
            body: { card_uid: "CARD-001", vehicle_type: "car" },
            session: { user: { user_id: 1 } },
        };
        const res = createResponse();

        lotsRepo.getParkingLotByManager.mockResolvedValue({ lot_id: 10, lot_name: "Test Lot" });
        sessionsRepo.checkMonthlySubByCard.mockResolvedValue({
            sub_id: 1,
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

        expect(sessionsRepo.startSession).toHaveBeenCalledWith(
            expect.objectContaining({ is_monthly: true })
        );
        expect(res.status).toHaveBeenCalledWith(201);
    });

    it("calls startSession with is_monthly: false when card has no active subscription", async () => {
        const { controller, sessionsRepo, lotsRepo } = loadControllerWithFlag(true);

        const req = {
            body: { card_uid: "CARD-002", vehicle_type: "car" },
            session: { user: { user_id: 1 } },
        };
        const res = createResponse();

        lotsRepo.getParkingLotByManager.mockResolvedValue({ lot_id: 10, lot_name: "Test Lot" });
        sessionsRepo.checkMonthlySubByCard.mockResolvedValue(undefined);
        sessionsRepo.startSession.mockResolvedValue({
            session_id: 2,
            license_plate: null,
            vehicle_type: "car",
            time_in: "2026-01-01T08:00:00.000Z",
            is_monthly: false,
            lot_id: 10,
        });

        await controller.checkInByRfid(req, res);

        expect(sessionsRepo.startSession).toHaveBeenCalledWith(
            expect.objectContaining({ is_monthly: false })
        );
        expect(res.status).toHaveBeenCalledWith(201);
    });
});

describe("Bug 2 fix — checkMonthlySubByCard repository function", () => {
    const today = "2026-04-27";

    afterEach(() => {
        mockPoolQuery.mockReset();
    });

    it("returns the subscription row when a matching record exists", async () => {
        const mockRow = {
            sub_id: 42,
            card_uid: "CARD-001",
            vehicle_type: "car",
            start_date: "2026-01-01",
            end_date: "2026-12-31",
        };
        mockPoolQuery.mockResolvedValue({ rows: [mockRow] });

        const result = await checkMonthlySubByCard("CARD-001", "car", today);

        expect(result).toEqual(mockRow);
        expect(mockPoolQuery).toHaveBeenCalledWith(
            expect.stringContaining("card_uid"),
            ["CARD-001", "car", today]
        );
    });

    it("returns undefined when no matching record exists", async () => {
        mockPoolQuery.mockResolvedValue({ rows: [] });

        const result = await checkMonthlySubByCard("CARD-002", "bike", today);

        expect(result).toBeUndefined();
    });
});
