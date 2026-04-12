const sessionsRepo = require("../../repositories/employee.sessions.repo");
const lotsRepo = require("../../repositories/admin.lots.repo");
const controller = require("../../controllers/employee.sessions.controller");

jest.mock("../../repositories/employee.sessions.repo");
jest.mock("../../repositories/admin.lots.repo");

describe("employee.sessions.controller checkInVehicle", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("returns 422 when vehicle_type is provided but identity is missing", async () => {
        const req = {
            body: {
                vehicle_type: "car",
            },
            session: {
                user: { user_id: 11 },
            },
        };
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };

        await controller.checkInVehicle(req, res);

        expect(res.status).toHaveBeenCalledWith(422);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            message: "Missing required fields",
        });
        expect(lotsRepo.getParkingLotByManager).not.toHaveBeenCalled();
        expect(sessionsRepo.startSession).not.toHaveBeenCalled();
    });

    it("checks in successfully with card_uid only", async () => {
        const req = {
            body: {
                vehicle_type: "car",
                card_uid: "CARD-1001",
                entry_lane_id: "lane-1",
                image_in_url: "https://example.com/in.jpg",
                metadata_in: { source: "rfid" },
            },
            session: {
                user: { user_id: 11 },
            },
        };
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };

        lotsRepo.getParkingLotByManager.mockResolvedValue({ lot_id: 5, lot_name: "Assigned Lot" });
        sessionsRepo.startSession.mockResolvedValue({
            session_id: 321,
            license_plate: null,
            vehicle_type: "car",
            time_in: "2026-01-01T10:00:00.000Z",
            is_monthly: false,
            lot_id: 5,
        });

        await controller.checkInVehicle(req, res);

        expect(sessionsRepo.checkMonthlySub).not.toHaveBeenCalled();
        expect(sessionsRepo.startSession).toHaveBeenCalledWith({
            lot_id: 5,
            license_plate: null,
            vehicle_type: "car",
            is_monthly: false,
            card_uid: "CARD-1001",
            entry_lane_id: "lane-1",
            image_in_url: "https://example.com/in.jpg",
            metadata_in: { source: "rfid" },
        });
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                success: true,
                message: "Vehicle checked in successfully",
            })
        );
    });

    it("ignores client is_monthly flag when no verified monthly subscription exists", async () => {
        const req = {
            body: {
                vehicle_type: "car",
                card_uid: "CARD-2001",
                is_monthly: true,
            },
            session: {
                user: { user_id: 11 },
            },
        };
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };

        lotsRepo.getParkingLotByManager.mockResolvedValue({ lot_id: 5, lot_name: "Assigned Lot" });
        sessionsRepo.startSession.mockResolvedValue({
            session_id: 322,
            license_plate: null,
            vehicle_type: "car",
            time_in: "2026-01-01T10:00:00.000Z",
            is_monthly: false,
            lot_id: 5,
        });

        await controller.checkInVehicle(req, res);

        expect(sessionsRepo.checkMonthlySub).not.toHaveBeenCalled();
        expect(sessionsRepo.startSession).toHaveBeenCalledWith(
            expect.objectContaining({
                is_monthly: false,
            })
        );
        expect(res.status).toHaveBeenCalledWith(201);
    });

    it("checks in successfully with etag_epc only", async () => {
        const req = {
            body: {
                vehicle_type: "bike",
                etag_epc: "E200001B",
            },
            session: {
                user: { user_id: 11 },
            },
        };
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };

        lotsRepo.getParkingLotByManager.mockResolvedValue({ lot_id: 5, lot_name: "Assigned Lot" });
        sessionsRepo.startSession.mockResolvedValue({
            session_id: 323,
            license_plate: null,
            vehicle_type: "bike",
            time_in: "2026-01-01T10:00:00.000Z",
            is_monthly: false,
            lot_id: 5,
        });

        await controller.checkInVehicle(req, res);

        expect(sessionsRepo.startSession).toHaveBeenCalledWith(
            expect.objectContaining({
                etag_epc: "E200001B",
                vehicle_type: "bike",
            })
        );
        expect(res.status).toHaveBeenCalledWith(201);
    });

    it("maps LOT_NOT_FOUND repository error to 404", async () => {
        const req = {
            body: {
                vehicle_type: "car",
                card_uid: "CARD-404",
            },
            session: {
                user: { user_id: 11 },
            },
        };
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };

        lotsRepo.getParkingLotByManager.mockResolvedValue({ lot_id: 5, lot_name: "Assigned Lot" });
        sessionsRepo.startSession.mockRejectedValue({
            code: "LOT_NOT_FOUND",
            message: "Parking lot not found",
        });

        await controller.checkInVehicle(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            message: "Parking lot not found",
        });
    });

    it("preserves active plate unique-conflict mapping", async () => {
        const req = {
            body: {
                vehicle_type: "car",
                license_plate: "30A-12345",
            },
            session: {
                user: { user_id: 11 },
            },
        };
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };

        lotsRepo.getParkingLotByManager.mockResolvedValue({ lot_id: 5, lot_name: "Assigned Lot" });
        sessionsRepo.checkMonthlySub.mockResolvedValue(null);
        sessionsRepo.startSession.mockRejectedValue({
            code: "23505",
            constraint: "uq_active_session_plate",
        });

        await controller.checkInVehicle(req, res);

        expect(res.status).toHaveBeenCalledWith(409);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            message: "This vehicle already has an active session",
        });
    });
});
