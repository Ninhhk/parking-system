const sessionsRepo = require("../../repositories/employee.sessions.repo");
const lotsRepo = require("../../repositories/admin.lots.repo");
const parkingCardsRepo = require("../../repositories/parkingCards.repo");
const controller = require("../../controllers/employee.sessions.controller");

jest.mock("../../repositories/employee.sessions.repo");
jest.mock("../../repositories/admin.lots.repo");
jest.mock("../../repositories/parkingCards.repo");
jest.mock("../../config/minio", () => ({
    minioClient: null,
    MINIO_BUCKET: "parking-images",
    isMinioConfigured: false,
    MINIO_EXTERNAL_ENDPOINT: "localhost",
    MINIO_EXTERNAL_PORT: 9000,
}));
jest.mock("../../services/minio.service", () => ({
    getPresignedUrl: jest.fn().mockResolvedValue(null),
    uploadImage: jest.fn().mockResolvedValue(null),
    deriveObjectKey: jest.fn().mockReturnValue("test-key"),
}));
jest.mock("../../services/image.upload.helper", () => ({
    uploadCheckinImage: jest.fn().mockResolvedValue(null),
    uploadCheckoutImage: jest.fn().mockResolvedValue(null),
    isBase64Image: jest.fn().mockReturnValue(false),
    parseBase64Image: jest.fn().mockReturnValue({ raw: "", ext: "jpg" }),
}));

const makeRes = () => ({
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
});

const ASSIGNED_LOT = { lot_id: 5, lot_name: "Assigned Lot" };

const sessionFor = (overrides = {}) => ({
    session_id: 900,
    license_plate: null,
    vehicle_type: "car",
    time_in: "2026-01-01T10:00:00.000Z",
    is_monthly: false,
    lot_id: 5,
    ...overrides,
});

describe("checkInVehicle casual identity + pool validation", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        lotsRepo.getParkingLotByManager.mockResolvedValue(ASSIGNED_LOT);
    });

    // Requirement 8.2: casual entry needs only vehicle_type; identity optional
    it("creates a session for a casual entry with NO identity", async () => {
        const req = {
            body: {
                vehicle_type: "car",
                metadata_in: { entry_type: "casual" },
            },
            session: { user: { user_id: 11 } },
        };
        const res = makeRes();
        sessionsRepo.startSession.mockResolvedValue(sessionFor());

        await controller.checkInVehicle(req, res);

        expect(res.status).not.toHaveBeenCalledWith(422);
        expect(parkingCardsRepo.getPoolCard).not.toHaveBeenCalled();
        expect(sessionsRepo.startSession).toHaveBeenCalledWith(
            expect.objectContaining({
                lot_id: 5,
                license_plate: null,
                vehicle_type: "car",
                is_monthly: false,
                metadata_in: { entry_type: "casual" },
            })
        );
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                success: true,
                message: "Vehicle checked in successfully",
            })
        );
    });

    // Requirement 8.2 (preserved behavior): non-casual still requires identity
    it("returns 422 for a non-casual entry with NO identity", async () => {
        const req = {
            body: {
                vehicle_type: "car",
            },
            session: { user: { user_id: 11 } },
        };
        const res = makeRes();

        await controller.checkInVehicle(req, res);

        expect(res.status).toHaveBeenCalledWith(422);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            message: "Missing required fields",
        });
        expect(sessionsRepo.startSession).not.toHaveBeenCalled();
    });

    // Requirement 8.2: issued-card casual, card not in pool -> 422 "Card not recognized"
    it("returns 422 'Card not recognized' when card_uid is not in the pool", async () => {
        const req = {
            body: {
                vehicle_type: "car",
                card_uid: "CARD-UNKNOWN",
                metadata_in: { entry_type: "casual" },
            },
            session: { user: { user_id: 11 } },
        };
        const res = makeRes();
        parkingCardsRepo.getPoolCard.mockResolvedValue(null);

        await controller.checkInVehicle(req, res);

        expect(parkingCardsRepo.getPoolCard).toHaveBeenCalledWith("CARD-UNKNOWN");
        expect(res.status).toHaveBeenCalledWith(422);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            message: "Card not recognized",
        });
        expect(sessionsRepo.startSession).not.toHaveBeenCalled();
    });

    // Requirement 8.3: issued-card casual, pool card status "lost" -> 409 "Card unavailable"
    it("returns 409 'Card unavailable' when the pool card status is lost", async () => {
        const req = {
            body: {
                vehicle_type: "car",
                card_uid: "CARD-LOST",
                metadata_in: { entry_type: "casual" },
            },
            session: { user: { user_id: 11 } },
        };
        const res = makeRes();
        parkingCardsRepo.getPoolCard.mockResolvedValue({
            card_uid: "CARD-LOST",
            lot_id: 5,
            status: "lost",
        });

        await controller.checkInVehicle(req, res);

        expect(parkingCardsRepo.getPoolCard).toHaveBeenCalledWith("CARD-LOST");
        expect(res.status).toHaveBeenCalledWith(409);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            message: "Card unavailable",
        });
        expect(sessionsRepo.startSession).not.toHaveBeenCalled();
    });

    // Requirement 8.4: issued-card casual, pool card assigned to a different lot -> 422
    it("returns 422 'Card not valid at this lot' when the pool card belongs to another lot", async () => {
        const req = {
            body: {
                vehicle_type: "car",
                card_uid: "CARD-OTHER-LOT",
                metadata_in: { entry_type: "casual" },
            },
            session: { user: { user_id: 11 } },
        };
        const res = makeRes();
        parkingCardsRepo.getPoolCard.mockResolvedValue({
            card_uid: "CARD-OTHER-LOT",
            lot_id: 7, // assigned to a different lot than the employee's lot (5)
            status: "available",
        });

        await controller.checkInVehicle(req, res);

        expect(parkingCardsRepo.getPoolCard).toHaveBeenCalledWith("CARD-OTHER-LOT");
        expect(res.status).toHaveBeenCalledWith(422);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            message: "Card not valid at this lot",
        });
        expect(sessionsRepo.startSession).not.toHaveBeenCalled();
    });

    // Requirement 8.1: issued-card casual, available pool card -> proceeds to session creation
    it("proceeds to session creation when the pool card is available", async () => {
        const req = {
            body: {
                vehicle_type: "car",
                card_uid: "CARD-OK",
                metadata_in: { entry_type: "casual" },
            },
            session: { user: { user_id: 11 } },
        };
        const res = makeRes();
        parkingCardsRepo.getPoolCard.mockResolvedValue({
            card_uid: "CARD-OK",
            lot_id: 5,
            status: "available",
        });
        sessionsRepo.startSession.mockResolvedValue(sessionFor({ session_id: 901 }));

        await controller.checkInVehicle(req, res);

        expect(parkingCardsRepo.getPoolCard).toHaveBeenCalledWith("CARD-OK");
        expect(sessionsRepo.startSession).toHaveBeenCalledWith(
            expect.objectContaining({ card_uid: "CARD-OK" })
        );
        expect(res.status).toHaveBeenCalledWith(201);
    });

    // Requirement 8.2: capacity is still enforced for casual entries
    it("returns 409 'lot is full' when startSession returns null (capacity)", async () => {
        const req = {
            body: {
                vehicle_type: "car",
                metadata_in: { entry_type: "casual" },
            },
            session: { user: { user_id: 11 } },
        };
        const res = makeRes();
        sessionsRepo.startSession.mockResolvedValue(null);

        await controller.checkInVehicle(req, res);

        expect(sessionsRepo.startSession).toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(409);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            message: "Parking lot is full for cars",
        });
    });
});
