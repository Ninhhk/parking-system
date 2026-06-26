const controller = require("../../controllers/session.audit.controller");
const service = require("../../services/session.audit.service");

jest.mock("../../services/session.audit.service");

describe("session.audit.controller", () => {
    let req, res;

    beforeEach(() => {
        jest.clearAllMocks();
        req = { query: {} };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };
    });

    describe("getAuditSessions - plate validation (422)", () => {
        it("returns 422 when plate is empty string", async () => {
            req.query = { plate: "" };

            await controller.getAuditSessions(req, res);

            expect(res.status).toHaveBeenCalledWith(422);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                message: expect.stringContaining("license plate"),
            });
        });

        it("returns 422 when plate is whitespace-only", async () => {
            req.query = { plate: "   " };

            await controller.getAuditSessions(req, res);

            expect(res.status).toHaveBeenCalledWith(422);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                message: expect.stringContaining("license plate"),
            });
        });

        it("returns 422 when plate exceeds 20 characters", async () => {
            req.query = { plate: "A".repeat(21) };

            await controller.getAuditSessions(req, res);

            expect(res.status).toHaveBeenCalledWith(422);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                message: expect.stringContaining("license plate"),
            });
        });
    });

    describe("getAuditSessions - pageSize validation (422)", () => {
        it("returns 422 when pageSize is less than 1", async () => {
            req.query = { pageSize: "0" };

            await controller.getAuditSessions(req, res);

            expect(res.status).toHaveBeenCalledWith(422);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                message: expect.stringContaining("Page size"),
            });
        });

        it("returns 422 when pageSize is greater than 100", async () => {
            req.query = { pageSize: "101" };

            await controller.getAuditSessions(req, res);

            expect(res.status).toHaveBeenCalledWith(422);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                message: expect.stringContaining("Page size"),
            });
        });
    });

    describe("getAuditSessions - date validation (422)", () => {
        it("returns 422 when startDate is not YYYY-MM-DD format", async () => {
            req.query = { startDate: "01-15-2024" };

            await controller.getAuditSessions(req, res);

            expect(res.status).toHaveBeenCalledWith(422);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                message: expect.stringContaining("date format"),
            });
        });

        it("returns 422 when endDate is not YYYY-MM-DD format", async () => {
            req.query = { endDate: "2024/01/15" };

            await controller.getAuditSessions(req, res);

            expect(res.status).toHaveBeenCalledWith(422);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                message: expect.stringContaining("date format"),
            });
        });

        it("returns 422 when startDate is after endDate", async () => {
            req.query = { startDate: "2024-02-01", endDate: "2024-01-01" };

            await controller.getAuditSessions(req, res);

            expect(res.status).toHaveBeenCalledWith(422);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                message: expect.stringContaining("Start date must not be later than end date"),
            });
        });
    });

    describe("getAuditSessions - success (200)", () => {
        it("returns 200 with correct response format when service succeeds", async () => {
            const mockResult = {
                sessions: [
                    {
                        session_id: 1,
                        license_plate: "51F-123.45",
                        vehicle_type: "car",
                        lot_name: "Lot A",
                        time_in: "2024-01-15T08:30:00.000Z",
                        time_out: "2024-01-15T17:45:00.000Z",
                        parking_fee: 50000,
                        status: "Completed",
                        image_in_url: null,
                        image_out_url: null,
                    },
                ],
                pagination: {
                    page: 1,
                    pageSize: 20,
                    totalCount: 1,
                    totalPages: 1,
                },
            };

            service.getAuditSessions.mockResolvedValue(mockResult);

            req.query = { plate: "51F" };
            req.session = { user: { role: "admin", user_id: 1 } };

            await controller.getAuditSessions(req, res);

            expect(service.getAuditSessions).toHaveBeenCalledWith({
                plate: "51F",
                sessionId: undefined,
                cardUid: undefined,
                startDate: undefined,
                endDate: undefined,
                vehicleType: undefined,
                lotId: undefined,
                page: 1,
                pageSize: 20,
                requesterRole: "admin",
                requesterId: 1,
            });
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith({
                success: true,
                data: mockResult,
            });
        });
    });
});
