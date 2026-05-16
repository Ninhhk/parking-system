const sessionsRepo = require("../../repositories/employee.sessions.repo");
const { calculateAndValidateFee } = require("../../services/feeCalculation.service");
const { getPresignedUrl } = require("../../services/minio.service");
const controller = require("../../controllers/employee.sessions.controller");

jest.mock("../../repositories/employee.sessions.repo");
jest.mock("../../repositories/admin.lots.repo");
jest.mock("../../services/feeCalculation.service");
jest.mock("../../config/constants", () => ({
    LICENSE_PLATE_REGEX: /^[A-Z0-9-]+$/i,
    VALID_PAYMENT_METHODS: ["CASH", "CARD"],
    VALID_VEHICLE_TYPES: ["car", "bike"],
    RFID_CHECKIN_ENABLED: true,
}));
jest.mock("../../services/checkout.service");
jest.mock("../../services/image.upload.helper", () => ({
    uploadCheckinImage: jest.fn().mockResolvedValue(null),
    uploadCheckoutImage: jest.fn().mockResolvedValue(null),
    isBase64Image: jest.fn().mockReturnValue(false),
    parseBase64Image: jest.fn().mockReturnValue({ raw: "", ext: "jpg" }),
}));
jest.mock("../../config/minio", () => ({
    minioClient: null,
    MINIO_BUCKET: "parking-images",
    isMinioConfigured: false,
    MINIO_EXTERNAL_ENDPOINT: "localhost",
    MINIO_EXTERNAL_PORT: 9000,
}));
jest.mock("../../services/minio.service", () => ({
    getPresignedUrl: jest.fn(),
    uploadImage: jest.fn().mockResolvedValue(null),
    deriveObjectKey: jest.fn().mockReturnValue("test-key"),
}));

/**
 * Validates: Requirements 6.1
 * Tests presigned URL enrichment in initiateCheckout response.
 */
describe("initiateCheckout presigned URL enrichment", () => {
    let req;
    let res;

    const baseSession = {
        session_id: 100,
        lot_id: 1,
        license_plate: "30A-12345",
        vehicle_type: "car",
        time_in: "2025-01-01T08:00:00.000Z",
        time_out: null,
        is_monthly: false,
        image_in_url: null,
        image_out_url: null,
    };

    beforeEach(() => {
        jest.clearAllMocks();
        req = { params: { session_id: "100" } };
        res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
        sessionsRepo.syncLostTicketStatus.mockResolvedValue();
        calculateAndValidateFee.mockResolvedValue({
            success: true,
            totalAmount: 20000,
            hours: 2,
            serviceFee: 0,
            penaltyFee: 0,
        });
    });

    it("includes presigned URLs when session has both image keys", async () => {
        const session = {
            ...baseSession,
            image_in_url: "1/2025-01-01/100_in.jpg",
            image_out_url: "1/2025-01-01/100_out.jpg",
        };
        sessionsRepo.getSession.mockResolvedValue(session);
        getPresignedUrl
            .mockResolvedValueOnce("http://localhost:9000/parking-images/1/2025-01-01/100_in.jpg?token=abc")
            .mockResolvedValueOnce("http://localhost:9000/parking-images/1/2025-01-01/100_out.jpg?token=def");

        await controller.initiateCheckout(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        const body = res.json.mock.calls[0][0];
        expect(body.session_details.image_in_presigned).toBe(
            "http://localhost:9000/parking-images/1/2025-01-01/100_in.jpg?token=abc"
        );
        expect(body.session_details.image_out_presigned).toBe(
            "http://localhost:9000/parking-images/1/2025-01-01/100_out.jpg?token=def"
        );
    });

    it("returns null presigned fields when image keys are null", async () => {
        sessionsRepo.getSession.mockResolvedValue({ ...baseSession });

        await controller.initiateCheckout(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        const body = res.json.mock.calls[0][0];
        expect(body.session_details.image_in_presigned).toBeNull();
        expect(body.session_details.image_out_presigned).toBeNull();
        // getPresignedUrl should not be called for null keys
        expect(getPresignedUrl).not.toHaveBeenCalled();
    });

    it("returns null presigned fields when getPresignedUrl returns null (MinIO unreachable)", async () => {
        const session = {
            ...baseSession,
            image_in_url: "1/2025-01-01/100_in.jpg",
            image_out_url: "1/2025-01-01/100_out.jpg",
        };
        sessionsRepo.getSession.mockResolvedValue(session);
        getPresignedUrl.mockResolvedValue(null);

        await controller.initiateCheckout(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        const body = res.json.mock.calls[0][0];
        expect(body.session_details.image_in_presigned).toBeNull();
        expect(body.session_details.image_out_presigned).toBeNull();
        expect(body.success).toBe(true);
    });
});
