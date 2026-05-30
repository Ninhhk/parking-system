jest.mock("../../repositories/session.audit.repo", () => ({
    lotExists: jest.fn(),
    findSessions: jest.fn(),
}));

jest.mock("../../services/minio.service", () => ({
    getPresignedUrl: jest.fn(),
}));

const { deriveSessionStatus, getAuditSessions } = require("../../services/session.audit.service");
const sessionAuditRepo = require("../../repositories/session.audit.repo");
const { getPresignedUrl } = require("../../services/minio.service");

describe("session.audit.service", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // --- deriveSessionStatus (pure function, no mocking needed) ---

    describe("deriveSessionStatus", () => {
        it("returns 'Lost Ticket' when is_lost is true", () => {
            expect(deriveSessionStatus({ is_lost: true, time_out: null })).toBe("Lost Ticket");
        });

        it("returns 'Lost Ticket' when is_lost is true even if time_out is set", () => {
            expect(deriveSessionStatus({ is_lost: true, time_out: "2024-01-15T17:00:00Z" })).toBe("Lost Ticket");
        });

        it("returns 'Completed' when is_lost is false and time_out is set", () => {
            expect(deriveSessionStatus({ is_lost: false, time_out: "2024-01-15T17:00:00Z" })).toBe("Completed");
        });

        it("returns 'Active' when is_lost is false and time_out is null", () => {
            expect(deriveSessionStatus({ is_lost: false, time_out: null })).toBe("Active");
        });
    });

    // --- getAuditSessions ---

    describe("getAuditSessions", () => {
        it("throws 422 when lotId does not exist", async () => {
            sessionAuditRepo.lotExists.mockResolvedValue(false);

            const err = await getAuditSessions({ lotId: 999, page: 1, pageSize: 20 }).catch((e) => e);

            expect(err).toBeInstanceOf(Error);
            expect(err.message).toBe("Parking lot not found");
            expect(err.status).toBe(422);
            expect(sessionAuditRepo.findSessions).not.toHaveBeenCalled();
        });

        it("does not validate lot existence when lotId is not provided", async () => {
            sessionAuditRepo.findSessions.mockResolvedValue({ rows: [], totalCount: 0 });

            await getAuditSessions({ page: 1, pageSize: 20 });

            expect(sessionAuditRepo.lotExists).not.toHaveBeenCalled();
        });

        it("generates presigned URL when image_in_url exists", async () => {
            sessionAuditRepo.lotExists.mockResolvedValue(true);
            sessionAuditRepo.findSessions.mockResolvedValue({
                rows: [{
                    session_id: 1,
                    license_plate: "51F-123.45",
                    vehicle_type: "car",
                    lot_name: "Lot A",
                    time_in: "2024-01-15T08:00:00Z",
                    time_out: "2024-01-15T17:00:00Z",
                    parking_fee: 50000,
                    is_lost: false,
                    image_in_url: "lot1/2024-01-15/1_in.jpg",
                    image_out_url: null,
                }],
                totalCount: 1,
            });
            getPresignedUrl.mockResolvedValue("https://minio.local/presigned-in");

            const result = await getAuditSessions({ lotId: 1, page: 1, pageSize: 20 });

            expect(getPresignedUrl).toHaveBeenCalledWith("lot1/2024-01-15/1_in.jpg");
            expect(result.sessions[0].image_in_url).toBe("https://minio.local/presigned-in");
            expect(result.sessions[0].image_out_url).toBeNull();
        });

        it("returns null for image URL when getPresignedUrl returns null (MinIO failure)", async () => {
            sessionAuditRepo.findSessions.mockResolvedValue({
                rows: [{
                    session_id: 2,
                    license_plate: "30A-999.99",
                    vehicle_type: "bike",
                    lot_name: "Lot B",
                    time_in: "2024-02-01T09:00:00Z",
                    time_out: null,
                    parking_fee: 0,
                    is_lost: false,
                    image_in_url: "lot2/2024-02-01/2_in.jpg",
                    image_out_url: "lot2/2024-02-01/2_out.jpg",
                }],
                totalCount: 1,
            });
            getPresignedUrl.mockResolvedValue(null);

            const result = await getAuditSessions({ page: 1, pageSize: 20 });

            expect(getPresignedUrl).toHaveBeenCalledTimes(2);
            expect(result.sessions[0].image_in_url).toBeNull();
            expect(result.sessions[0].image_out_url).toBeNull();
        });

        it("does not call getPresignedUrl when image fields are null", async () => {
            sessionAuditRepo.findSessions.mockResolvedValue({
                rows: [{
                    session_id: 3,
                    license_plate: "29B-111.22",
                    vehicle_type: "car",
                    lot_name: "Lot C",
                    time_in: "2024-03-01T10:00:00Z",
                    time_out: "2024-03-01T18:00:00Z",
                    parking_fee: 30000,
                    is_lost: false,
                    image_in_url: null,
                    image_out_url: null,
                }],
                totalCount: 1,
            });

            const result = await getAuditSessions({ page: 1, pageSize: 20 });

            expect(getPresignedUrl).not.toHaveBeenCalled();
            expect(result.sessions[0].image_in_url).toBeNull();
            expect(result.sessions[0].image_out_url).toBeNull();
        });

        it("calculates pagination metadata correctly", async () => {
            sessionAuditRepo.findSessions.mockResolvedValue({ rows: [], totalCount: 45 });

            const result = await getAuditSessions({ page: 2, pageSize: 20 });

            expect(result.pagination).toEqual({
                page: 2,
                pageSize: 20,
                totalCount: 45,
                totalPages: 3,
            });
        });

        it("returns totalPages 0 when totalCount is 0", async () => {
            sessionAuditRepo.findSessions.mockResolvedValue({ rows: [], totalCount: 0 });

            const result = await getAuditSessions({ page: 1, pageSize: 20 });

            expect(result.pagination).toEqual({
                page: 1,
                pageSize: 20,
                totalCount: 0,
                totalPages: 0,
            });
        });
    });
});
