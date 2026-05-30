const fc = require("fast-check");
const { getAuditSessions } = require("../../services/session.audit.service");

// Feature: session-audit-viewer, Property 6: Results are ordered by time_in descending
// Validates: Requirements 5.6

jest.mock("../../repositories/session.audit.repo");
jest.mock("../../services/minio.service");

const sessionAuditRepo = require("../../repositories/session.audit.repo");
const { getPresignedUrl } = require("../../services/minio.service");

/**
 * Generator: array of session objects with random time_in timestamps.
 * Each session has the minimum fields needed by the service.
 */
const sessionArb = fc.record({
    session_id: fc.integer({ min: 1, max: 100000 }),
    license_plate: fc.string({ minLength: 1, maxLength: 10 }),
    vehicle_type: fc.constantFrom("car", "bike"),
    lot_id: fc.integer({ min: 1, max: 10 }),
    lot_name: fc.string({ minLength: 1, maxLength: 20 }),
    time_in: fc.date({ min: new Date("2020-01-01"), max: new Date("2025-12-31") }),
    time_out: fc.oneof(fc.constant(null), fc.date({ min: new Date("2020-01-01"), max: new Date("2025-12-31") })),
    image_in_url: fc.constant(null),
    image_out_url: fc.constant(null),
    is_lost: fc.boolean(),
    parking_fee: fc.integer({ min: 0, max: 500000 }),
});

const sessionsArrayArb = fc.array(sessionArb, { minLength: 0, maxLength: 30 });

describe("Feature: session-audit-viewer, Property 6: Results are ordered by time_in descending", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        getPresignedUrl.mockResolvedValue(null);
    });

    it("service preserves descending time_in order from repository", async () => {
        await fc.assert(
            fc.asyncProperty(sessionsArrayArb, async (sessions) => {
                // Sort sessions by time_in descending (simulating DB ORDER BY)
                const sorted = [...sessions].sort(
                    (a, b) => new Date(b.time_in) - new Date(a.time_in)
                );

                sessionAuditRepo.findSessions.mockResolvedValue({
                    rows: sorted,
                    totalCount: sorted.length,
                });

                const result = await getAuditSessions({ page: 1, pageSize: 100 });

                // Verify each consecutive pair maintains descending order
                for (let i = 0; i < result.sessions.length - 1; i++) {
                    const current = new Date(result.sessions[i].time_in);
                    const next = new Date(result.sessions[i + 1].time_in);
                    if (current < next) return false;
                }
                return true;
            }),
            { numRuns: 100 }
        );
    });
});
