const sessionsRepo = require("../../repositories/employee.sessions.repo");
const parkingCardsRepo = require("../../repositories/parkingCards.repo");
const controller = require("../../controllers/employee.sessions.controller");

jest.mock("../../repositories/employee.sessions.repo");
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

describe("employee.sessions.controller reportLostTicket pool-card hook", () => {
    const validBody = {
        session_id: 99,
        guest_identification: "ID-123",
        guest_phone: "0900000000",
    };

    const makeReq = () => ({ body: { ...validBody } });
    const makeRes = () => ({
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
    });

    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(console, "error").mockImplementation(() => {});
        sessionsRepo.reportLostTicket.mockResolvedValue({ report_id: 1, penalty_fee: 50000 });
        sessionsRepo.syncLostTicketStatus.mockResolvedValue(undefined);
        parkingCardsRepo.markLost.mockResolvedValue(undefined);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    // Validates: Requirements 9.3
    it("marks the pool card lost when the session is bound to a card_uid", async () => {
        sessionsRepo.getSession.mockResolvedValue({ lot_id: 1, card_uid: "POOL-001" });
        const req = makeReq();
        const res = makeRes();

        await controller.reportLostTicket(req, res);

        expect(sessionsRepo.getSession).toHaveBeenCalledWith(99);
        expect(parkingCardsRepo.markLost).toHaveBeenCalledWith("POOL-001");
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ success: true, penalty_fee: 50000 })
        );
    });

    // Validates: Requirements 9.3
    it("does NOT mark a card lost when the session has no card_uid", async () => {
        sessionsRepo.getSession.mockResolvedValue({ lot_id: 1, card_uid: null });
        const req = makeReq();
        const res = makeRes();

        await controller.reportLostTicket(req, res);

        expect(parkingCardsRepo.markLost).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ success: true })
        );
    });

    // Validates: Requirements 9.4
    it("logs structured failure context and still returns 201 when markLost fails", async () => {
        sessionsRepo.getSession.mockResolvedValue({ lot_id: 1, card_uid: "POOL-001" });
        parkingCardsRepo.markLost.mockRejectedValue(new Error("db down"));
        const req = makeReq();
        const res = makeRes();

        await controller.reportLostTicket(req, res);

        expect(parkingCardsRepo.markLost).toHaveBeenCalledWith("POOL-001");
        expect(console.error).toHaveBeenCalledWith(
            JSON.stringify({ event: "pool_card_mark_lost_failed", card_uid: "POOL-001", session_id: 99 })
        );
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ success: true, penalty_fee: 50000 })
        );
    });
});
