const fc = require("fast-check");
const { getAuditSessions } = require("../../services/session.audit.service");
const sessionAuditRepo = require("../../repositories/session.audit.repo");
const minioService = require("../../services/minio.service");

// Feature: session-audit-viewer, Property 2: Pagination returns correct slice
// Validates: Requirements 1.3

jest.mock("../../repositories/session.audit.repo");
jest.mock("../../services/minio.service");

describe("Feature: session-audit-viewer, Property 2: Pagination returns correct slice", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        sessionAuditRepo.lotExists.mockResolvedValue(true);
        minioService.getPresignedUrl.mockResolvedValue(null);
    });

    it("returned sessions count is always ≤ pageSize", () => {
        return fc.assert(
            fc.asyncProperty(
                fc.integer({ min: 1, max: 10 }),   // page
                fc.integer({ min: 1, max: 100 }),  // pageSize
                fc.integer({ min: 0, max: 200 }),  // totalCount
                async (page, pageSize, totalCount) => {
                    const offset = (page - 1) * pageSize;
                    const expectedRowCount = Math.min(pageSize, Math.max(0, totalCount - offset));

                    const rows = Array.from({ length: expectedRowCount }, (_, i) => ({
                        session_id: i + 1,
                        license_plate: "ABC-123",
                        vehicle_type: "car",
                        lot_name: "Lot A",
                        time_in: new Date().toISOString(),
                        time_out: null,
                        parking_fee: 0,
                        is_lost: false,
                        image_in_url: null,
                        image_out_url: null,
                        total_count: totalCount,
                    }));

                    sessionAuditRepo.findSessions.mockResolvedValue({ rows, totalCount });

                    const result = await getAuditSessions({ page, pageSize });

                    return result.sessions.length <= pageSize;
                }
            ),
            { numRuns: 100 }
        );
    });

    it("totalCount in pagination matches the full filtered set count", () => {
        return fc.assert(
            fc.asyncProperty(
                fc.integer({ min: 1, max: 10 }),   // page
                fc.integer({ min: 1, max: 100 }),  // pageSize
                fc.integer({ min: 0, max: 200 }),  // totalCount
                async (page, pageSize, totalCount) => {
                    const offset = (page - 1) * pageSize;
                    const expectedRowCount = Math.min(pageSize, Math.max(0, totalCount - offset));

                    const rows = Array.from({ length: expectedRowCount }, (_, i) => ({
                        session_id: i + 1,
                        license_plate: "ABC-123",
                        vehicle_type: "car",
                        lot_name: "Lot A",
                        time_in: new Date().toISOString(),
                        time_out: null,
                        parking_fee: 0,
                        is_lost: false,
                        image_in_url: null,
                        image_out_url: null,
                        total_count: totalCount,
                    }));

                    sessionAuditRepo.findSessions.mockResolvedValue({ rows, totalCount });

                    const result = await getAuditSessions({ page, pageSize });

                    return result.pagination.totalCount === totalCount;
                }
            ),
            { numRuns: 100 }
        );
    });

    it("totalPages equals Math.ceil(totalCount / pageSize) or 0 when totalCount is 0", () => {
        return fc.assert(
            fc.asyncProperty(
                fc.integer({ min: 1, max: 10 }),   // page
                fc.integer({ min: 1, max: 100 }),  // pageSize
                fc.integer({ min: 0, max: 200 }),  // totalCount
                async (page, pageSize, totalCount) => {
                    const offset = (page - 1) * pageSize;
                    const expectedRowCount = Math.min(pageSize, Math.max(0, totalCount - offset));

                    const rows = Array.from({ length: expectedRowCount }, (_, i) => ({
                        session_id: i + 1,
                        license_plate: "ABC-123",
                        vehicle_type: "car",
                        lot_name: "Lot A",
                        time_in: new Date().toISOString(),
                        time_out: null,
                        parking_fee: 0,
                        is_lost: false,
                        image_in_url: null,
                        image_out_url: null,
                        total_count: totalCount,
                    }));

                    sessionAuditRepo.findSessions.mockResolvedValue({ rows, totalCount });

                    const result = await getAuditSessions({ page, pageSize });

                    const expectedTotalPages = Math.ceil(totalCount / pageSize) || 0;
                    return result.pagination.totalPages === expectedTotalPages;
                }
            ),
            { numRuns: 100 }
        );
    });
});
