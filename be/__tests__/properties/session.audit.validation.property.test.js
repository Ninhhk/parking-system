const fc = require("fast-check");
const controller = require("../../controllers/session.audit.controller");
const service = require("../../services/session.audit.service");

// Feature: session-audit-viewer, Property 3: Invalid input validation
// Validates: Requirements 1.4, 1.5, 2.4, 2.5

jest.mock("../../services/session.audit.service");

describe("Feature: session-audit-viewer, Property 3: Invalid input validation", () => {
    let req, res;

    function freshRes() {
        return {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };
    }

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("Invalid plates return 422", () => {
        it("empty string plate returns 422", async () => {
            await fc.assert(
                fc.asyncProperty(
                    fc.constant(""),
                    async (plate) => {
                        req = { query: { plate } };
                        res = freshRes();
                        await controller.getAuditSessions(req, res);
                        return res.status.mock.calls[0][0] === 422 &&
                            res.json.mock.calls[0][0].success === false;
                    }
                ),
                { numRuns: 100 }
            );
        });

        it("whitespace-only plates return 422", async () => {
            // Generate strings composed only of whitespace chars (space, tab)
            const whitespaceArb = fc.array(
                fc.constantFrom(" ", "  ", "\t", "   "),
                { minLength: 1, maxLength: 5 }
            ).map(arr => arr.join(""));

            await fc.assert(
                fc.asyncProperty(
                    whitespaceArb,
                    async (plate) => {
                        req = { query: { plate } };
                        res = freshRes();
                        await controller.getAuditSessions(req, res);
                        return res.status.mock.calls[0][0] === 422 &&
                            res.json.mock.calls[0][0].success === false;
                    }
                ),
                { numRuns: 100 }
            );
        });

        it("plates exceeding 20 characters return 422", async () => {
            // Generate non-whitespace strings > 20 chars to ensure they hit the length check
            const longPlateArb = fc.string({ minLength: 21, maxLength: 50 })
                .filter(s => s.trim().length > 0);

            await fc.assert(
                fc.asyncProperty(
                    longPlateArb,
                    async (plate) => {
                        req = { query: { plate } };
                        res = freshRes();
                        await controller.getAuditSessions(req, res);
                        return res.status.mock.calls[0][0] === 422 &&
                            res.json.mock.calls[0][0].success === false;
                    }
                ),
                { numRuns: 100 }
            );
        });
    });

    describe("Invalid page sizes return 422", () => {
        it("page size < 1 returns 422", async () => {
            await fc.assert(
                fc.asyncProperty(
                    fc.integer({ min: -1000, max: 0 }),
                    async (pageSize) => {
                        req = { query: { pageSize: String(pageSize) } };
                        res = freshRes();
                        await controller.getAuditSessions(req, res);
                        return res.status.mock.calls[0][0] === 422 &&
                            res.json.mock.calls[0][0].success === false;
                    }
                ),
                { numRuns: 100 }
            );
        });

        it("page size > 100 returns 422", async () => {
            await fc.assert(
                fc.asyncProperty(
                    fc.integer({ min: 101, max: 10000 }),
                    async (pageSize) => {
                        req = { query: { pageSize: String(pageSize) } };
                        res = freshRes();
                        await controller.getAuditSessions(req, res);
                        return res.status.mock.calls[0][0] === 422 &&
                            res.json.mock.calls[0][0].success === false;
                    }
                ),
                { numRuns: 100 }
            );
        });
    });

    describe("Invalid date formats return 422", () => {
        it("startDate not matching YYYY-MM-DD returns 422", async () => {
            const invalidDateArb = fc.oneof(
                // Random strings that don't match YYYY-MM-DD (non-empty, no accidental matches)
                fc.string({ minLength: 1, maxLength: 20 })
                    .filter(s => !/^\d{4}-\d{2}-\d{2}$/.test(s)),
                // Wrong separator format: YYYY/MM/DD
                fc.tuple(
                    fc.integer({ min: 2000, max: 2030 }),
                    fc.integer({ min: 1, max: 12 }),
                    fc.integer({ min: 1, max: 28 })
                ).map(([y, m, d]) => `${y}/${String(m).padStart(2, "0")}/${String(d).padStart(2, "0")}`),
                // Reversed format: DD-MM-YYYY
                fc.tuple(
                    fc.integer({ min: 1, max: 28 }),
                    fc.integer({ min: 1, max: 12 }),
                    fc.integer({ min: 2000, max: 2030 })
                ).map(([d, m, y]) => `${String(d).padStart(2, "0")}-${String(m).padStart(2, "0")}-${y}`)
            );

            await fc.assert(
                fc.asyncProperty(
                    invalidDateArb,
                    async (startDate) => {
                        req = { query: { startDate } };
                        res = freshRes();
                        await controller.getAuditSessions(req, res);
                        return res.status.mock.calls[0][0] === 422 &&
                            res.json.mock.calls[0][0].success === false;
                    }
                ),
                { numRuns: 100 }
            );
        });

        it("endDate not matching YYYY-MM-DD returns 422", async () => {
            const invalidDateArb = fc.oneof(
                fc.string({ minLength: 1, maxLength: 20 })
                    .filter(s => !/^\d{4}-\d{2}-\d{2}$/.test(s)),
                fc.tuple(
                    fc.integer({ min: 2000, max: 2030 }),
                    fc.integer({ min: 1, max: 12 }),
                    fc.integer({ min: 1, max: 28 })
                ).map(([y, m, d]) => `${y}/${String(m).padStart(2, "0")}/${String(d).padStart(2, "0")}`),
                fc.tuple(
                    fc.integer({ min: 1, max: 28 }),
                    fc.integer({ min: 1, max: 12 }),
                    fc.integer({ min: 2000, max: 2030 })
                ).map(([d, m, y]) => `${String(d).padStart(2, "0")}-${String(m).padStart(2, "0")}-${y}`)
            );

            await fc.assert(
                fc.asyncProperty(
                    invalidDateArb,
                    async (endDate) => {
                        req = { query: { endDate } };
                        res = freshRes();
                        await controller.getAuditSessions(req, res);
                        return res.status.mock.calls[0][0] === 422 &&
                            res.json.mock.calls[0][0].success === false;
                    }
                ),
                { numRuns: 100 }
            );
        });
    });

    describe("Start date after end date returns 422", () => {
        it("startDate > endDate returns 422", async () => {
            // Generate two valid YYYY-MM-DD dates where start is strictly after end
            const dateRangeArb = fc.tuple(
                fc.date({ min: new Date("2020-01-01"), max: new Date("2030-12-31") }),
                fc.integer({ min: 1, max: 365 })
            ).map(([endDateObj, daysAfter]) => {
                const startDateObj = new Date(endDateObj.getTime() + daysAfter * 86400000);
                const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
                return { startDate: fmt(startDateObj), endDate: fmt(endDateObj) };
            });

            await fc.assert(
                fc.asyncProperty(
                    dateRangeArb,
                    async ({ startDate, endDate }) => {
                        req = { query: { startDate, endDate } };
                        res = freshRes();
                        await controller.getAuditSessions(req, res);
                        return res.status.mock.calls[0][0] === 422 &&
                            res.json.mock.calls[0][0].success === false;
                    }
                ),
                { numRuns: 100 }
            );
        });
    });
});
