const fc = require("fast-check");

// Feature: session-audit-viewer, Property 8: Session detail response completeness
// Validates: Requirements 4.1

/**
 * Tests that every session returned by getAuditSessions includes ALL required fields
 * as defined keys, even when underlying values are null.
 *
 * Required fields: session_id, license_plate, vehicle_type, time_in, time_out,
 *                  lot_name, parking_fee, status, image_in_url, image_out_url
 */

const { getAuditSessions } = require("../../services/session.audit.service");
const sessionAuditRepo = require("../../repositories/session.audit.repo");
const minioService = require("../../services/minio.service");

jest.mock("../../repositories/session.audit.repo");
jest.mock("../../services/minio.service");

// Generator: random session row as returned by the repository
const sessionRowArb = fc.record({
    session_id: fc.integer({ min: 1, max: 100000 }),
    license_plate: fc.oneof(
        fc.stringMatching(/^[a-zA-Z0-9\-.]{1,20}$/),
        fc.constant(null)
    ),
    vehicle_type: fc.oneof(fc.constantFrom("car", "bike", "truck"), fc.constant(null)),
    lot_name: fc.oneof(
        fc.stringMatching(/^[a-zA-Z0-9 ]{1,30}$/),
        fc.constant(null)
    ),
    time_in: fc.oneof(fc.integer({ min: 946684800000, max: 1924905600000 }).map(ts => new Date(ts).toISOString()), fc.constant(null)),
    time_out: fc.oneof(fc.integer({ min: 946684800000, max: 1924905600000 }).map(ts => new Date(ts).toISOString()), fc.constant(null)),
    parking_fee: fc.oneof(fc.integer({ min: 0, max: 500000 }), fc.constant(null)),
    is_lost: fc.boolean(),
    image_in_url: fc.oneof(fc.constant("images/entry_123.jpg"), fc.constant(null)),
    image_out_url: fc.oneof(fc.constant("images/exit_456.jpg"), fc.constant(null)),
});

const REQUIRED_FIELDS = [
    "session_id",
    "license_plate",
    "vehicle_type",
    "time_in",
    "time_out",
    "lot_name",
    "parking_fee",
    "status",
    "image_in_url",
    "image_out_url",
];

describe("Feature: session-audit-viewer, Property 8: Session detail response completeness", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        sessionAuditRepo.lotExists.mockResolvedValue(true);
        minioService.getPresignedUrl.mockImplementation(async (key) =>
            key ? `https://minio.local/presigned/${key}` : null
        );
    });

    it("every session in the response has all required fields defined as keys", async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.array(sessionRowArb, { minLength: 1, maxLength: 20 }),
                async (rows) => {
                    sessionAuditRepo.findSessions.mockResolvedValue({
                        rows,
                        totalCount: rows.length,
                    });

                    const result = await getAuditSessions({ page: 1, pageSize: 20 });

                    // Property: every session object has ALL required fields as keys
                    return result.sessions.every(session =>
                        REQUIRED_FIELDS.every(field =>
                            Object.prototype.hasOwnProperty.call(session, field)
                        )
                    );
                }
            ),
            { numRuns: 100 }
        );
    });

    it("response has exactly the required fields and no unexpected fields", async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.array(sessionRowArb, { minLength: 1, maxLength: 10 }),
                async (rows) => {
                    sessionAuditRepo.findSessions.mockResolvedValue({
                        rows,
                        totalCount: rows.length,
                    });

                    const result = await getAuditSessions({ page: 1, pageSize: 20 });

                    // Property: each session has exactly the required field set
                    return result.sessions.every(session => {
                        const keys = Object.keys(session).sort();
                        const expected = [...REQUIRED_FIELDS].sort();
                        return (
                            keys.length === expected.length &&
                            keys.every((k, i) => k === expected[i])
                        );
                    });
                }
            ),
            { numRuns: 100 }
        );
    });

    it("fields exist even when underlying row values are null", async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.array(sessionRowArb, { minLength: 1, maxLength: 10 }),
                async (rows) => {
                    // Force all nullable fields to null
                    const nullRows = rows.map(r => ({
                        ...r,
                        license_plate: null,
                        vehicle_type: null,
                        time_out: null,
                        lot_name: null,
                        parking_fee: null,
                        image_in_url: null,
                        image_out_url: null,
                    }));

                    sessionAuditRepo.findSessions.mockResolvedValue({
                        rows: nullRows,
                        totalCount: nullRows.length,
                    });

                    const result = await getAuditSessions({ page: 1, pageSize: 20 });

                    // Property: keys still exist even when values are null
                    return result.sessions.every(session =>
                        REQUIRED_FIELDS.every(field =>
                            Object.prototype.hasOwnProperty.call(session, field)
                        )
                    );
                }
            ),
            { numRuns: 100 }
        );
    });
});
