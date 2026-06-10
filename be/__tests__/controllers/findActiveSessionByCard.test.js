const sessionsRepo = require("../../repositories/employee.sessions.repo");
const lotsRepo = require("../../repositories/admin.lots.repo");
const controller = require("../../controllers/employee.sessions.controller");

jest.mock("../../repositories/employee.sessions.repo");
jest.mock("../../repositories/admin.lots.repo");
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

describe("employee.sessions.controller findActiveSessionByCard", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("returns 422 when card_uid is blank", async () => {
        const req = { params: { card_uid: "  " }, session: { user: { user_id: 7 } } };
        const res = makeRes();

        await controller.findActiveSessionByCard(req, res);

        expect(res.status).toHaveBeenCalledWith(422);
        expect(lotsRepo.getParkingLotByManager).not.toHaveBeenCalled();
    });

    it("returns 404 when the employee manages no lot", async () => {
        lotsRepo.getParkingLotByManager.mockResolvedValue(null);
        const req = { params: { card_uid: "CARD-1" }, session: { user: { user_id: 7 } } };
        const res = makeRes();

        await controller.findActiveSessionByCard(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(sessionsRepo.findActiveByCardUid).not.toHaveBeenCalled();
    });

    it("returns 404 when no active session exists for the card", async () => {
        lotsRepo.getParkingLotByManager.mockResolvedValue({ lot_id: 3 });
        sessionsRepo.findActiveByCardUid.mockResolvedValue(null);
        const req = { params: { card_uid: "CARD-1" }, session: { user: { user_id: 7 } } };
        const res = makeRes();

        await controller.findActiveSessionByCard(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
    });

    it("returns 404 when the active session belongs to another lot", async () => {
        lotsRepo.getParkingLotByManager.mockResolvedValue({ lot_id: 3 });
        sessionsRepo.findActiveByCardUid.mockResolvedValue({ session_id: 50, lot_id: 9 });
        const req = { params: { card_uid: "CARD-1" }, session: { user: { user_id: 7 } } };
        const res = makeRes();

        await controller.findActiveSessionByCard(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
    });

    it("returns 200 with the session_id for a matching active session in the employee's lot", async () => {
        lotsRepo.getParkingLotByManager.mockResolvedValue({ lot_id: 3 });
        sessionsRepo.findActiveByCardUid.mockResolvedValue({ session_id: 50, lot_id: 3 });
        const req = { params: { card_uid: "CARD-1" }, session: { user: { user_id: 7 } } };
        const res = makeRes();

        await controller.findActiveSessionByCard(req, res);

        expect(sessionsRepo.findActiveByCardUid).toHaveBeenCalledWith("CARD-1");
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            success: true,
            data: { session_id: 50 },
        });
    });

    it("trims the card_uid before lookup", async () => {
        lotsRepo.getParkingLotByManager.mockResolvedValue({ lot_id: 3 });
        sessionsRepo.findActiveByCardUid.mockResolvedValue({ session_id: 51, lot_id: 3 });
        const req = { params: { card_uid: "  CARD-2  " }, session: { user: { user_id: 7 } } };
        const res = makeRes();

        await controller.findActiveSessionByCard(req, res);

        expect(sessionsRepo.findActiveByCardUid).toHaveBeenCalledWith("CARD-2");
        expect(res.status).toHaveBeenCalledWith(200);
    });
});
