const fc = require("fast-check");
const { validateSubRows } = require("../../services/batchImport.service");

const TODAY = "2025-01-01";

/**
 * Helper: format a JS Date as YYYY-MM-DD.
 */
function fmt(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

/**
 * Helper: generate a future date (strictly later than TODAY).
 */
const arbFutureDate = fc.date({
    min: new Date("2025-01-02"),
    max: new Date("2030-12-31"),
    noInvalidDate: true,
}).map(fmt);

/**
 * Helper: generate a past-or-today date (not strictly later than TODAY).
 */
const arbPastDate = fc.date({
    min: new Date("2020-01-01"),
    max: new Date("2025-01-01"),
    noInvalidDate: true,
}).map(fmt);

/**
 * Helper: generate a non-blank card_uid.
 */
const arbCardUid = fc.string({ minLength: 1, maxLength: 12 })
    .filter(s => s.trim().length > 0 && s === s.trim());

// Feature: batch-import-export, Property 4: Monthly-enable validation flags missing/unknown card_uid, missing/invalid/non-future monthly_end_date, and in-file duplicate card_uid
// **Validates: Requirements 2.2, 2.3, 2.5, 2.6**
describe("Feature: batch-import-export, Property 4: Monthly-enable validation", () => {
    it("flags rows missing card_uid", () => {
        fc.assert(
            fc.property(
                arbFutureDate,
                fc.integer({ min: 2, max: 100 }),
                (endDate, rowNum) => {
                    const rows = [{ __row: rowNum, card_uid: "", monthly_end_date: endDate }];
                    const ref = { existingCardUids: new Set(), today: TODAY };
                    const errors = validateSubRows(rows, ref);
                    const e = errors.filter(x => x.field === "card_uid" && x.row === rowNum);
                    expect(e.length).toBe(1);
                    expect(e[0].reason).toContain("required");
                }
            ),
            { numRuns: 100 }
        );
    });

    it("flags card_uid not in the card pool", () => {
        fc.assert(
            fc.property(
                arbCardUid,
                arbFutureDate,
                fc.integer({ min: 2, max: 100 }),
                (uid, endDate, rowNum) => {
                    const rows = [{ __row: rowNum, card_uid: uid, monthly_end_date: endDate }];
                    const ref = { existingCardUids: new Set(), today: TODAY };
                    const errors = validateSubRows(rows, ref);
                    const e = errors.filter(x => x.field === "card_uid" && x.row === rowNum);
                    expect(e.length).toBe(1);
                    expect(e[0].reason).toContain("does not exist");
                }
            ),
            { numRuns: 100 }
        );
    });

    it("does not flag card_uid that exists in the pool", () => {
        fc.assert(
            fc.property(
                arbCardUid,
                arbFutureDate,
                fc.integer({ min: 2, max: 100 }),
                (uid, endDate, rowNum) => {
                    const rows = [{ __row: rowNum, card_uid: uid, monthly_end_date: endDate }];
                    const ref = { existingCardUids: new Set([uid]), today: TODAY };
                    const errors = validateSubRows(rows, ref);
                    const e = errors.filter(x => x.field === "card_uid");
                    expect(e.length).toBe(0);
                }
            ),
            { numRuns: 100 }
        );
    });

    it("flags rows missing monthly_end_date", () => {
        fc.assert(
            fc.property(
                arbCardUid,
                fc.integer({ min: 2, max: 100 }),
                (uid, rowNum) => {
                    const rows = [{ __row: rowNum, card_uid: uid, monthly_end_date: "" }];
                    const ref = { existingCardUids: new Set([uid]), today: TODAY };
                    const errors = validateSubRows(rows, ref);
                    const e = errors.filter(x => x.field === "monthly_end_date" && x.row === rowNum);
                    expect(e.length).toBe(1);
                    expect(e[0].reason).toContain("required");
                }
            ),
            { numRuns: 100 }
        );
    });

    it("flags malformed monthly_end_date", () => {
        fc.assert(
            fc.property(
                arbCardUid,
                fc.string({ minLength: 1, maxLength: 10 }).filter(s => !/^\d{4}-\d{2}-\d{2}$/.test(s)),
                fc.integer({ min: 2, max: 100 }),
                (uid, badDate, rowNum) => {
                    const rows = [{ __row: rowNum, card_uid: uid, monthly_end_date: badDate }];
                    const ref = { existingCardUids: new Set([uid]), today: TODAY };
                    const errors = validateSubRows(rows, ref);
                    const e = errors.filter(x => x.field === "monthly_end_date" && x.row === rowNum);
                    expect(e.length).toBe(1);
                    expect(e[0].reason).toContain("valid YYYY-MM-DD");
                }
            ),
            { numRuns: 100 }
        );
    });

    it("flags monthly_end_date that is not strictly in the future", () => {
        fc.assert(
            fc.property(
                arbCardUid,
                arbPastDate,
                fc.integer({ min: 2, max: 100 }),
                (uid, pastDate, rowNum) => {
                    const rows = [{ __row: rowNum, card_uid: uid, monthly_end_date: pastDate }];
                    const ref = { existingCardUids: new Set([uid]), today: TODAY };
                    const errors = validateSubRows(rows, ref);
                    const e = errors.filter(x => x.field === "monthly_end_date" && x.row === rowNum);
                    expect(e.length).toBe(1);
                    expect(e[0].reason).toContain("future");
                }
            ),
            { numRuns: 100 }
        );
    });

    it("flags in-file duplicate card_uid on occurrences after the first", () => {
        fc.assert(
            fc.property(
                arbCardUid,
                arbFutureDate,
                fc.integer({ min: 2, max: 50 }),
                (uid, endDate, baseRow) => {
                    const rows = [
                        { __row: baseRow, card_uid: uid, monthly_end_date: endDate },
                        { __row: baseRow + 1, card_uid: uid, monthly_end_date: endDate },
                    ];
                    const ref = { existingCardUids: new Set([uid]), today: TODAY };
                    const errors = validateSubRows(rows, ref);
                    const dupErrors = errors.filter(x => x.reason === "duplicate card_uid in file");
                    expect(dupErrors.length).toBe(1);
                    expect(dupErrors[0].row).toBe(baseRow + 1);
                }
            ),
            { numRuns: 100 }
        );
    });

    it("produces no errors for valid rows", () => {
        fc.assert(
            fc.property(
                arbCardUid,
                arbFutureDate,
                fc.integer({ min: 2, max: 100 }),
                (uid, endDate, rowNum) => {
                    const rows = [{ __row: rowNum, card_uid: uid, monthly_end_date: endDate }];
                    const ref = { existingCardUids: new Set([uid]), today: TODAY };
                    const errors = validateSubRows(rows, ref);
                    expect(errors.length).toBe(0);
                }
            ),
            { numRuns: 100 }
        );
    });

    it("every error is well-formed (row, field, reason)", () => {
        fc.assert(
            fc.property(
                fc.array(
                    fc.record({
                        __row: fc.integer({ min: 2, max: 500 }),
                        card_uid: fc.oneof(fc.constant(""), arbCardUid),
                        monthly_end_date: fc.oneof(fc.constant(""), arbPastDate, arbFutureDate),
                    }),
                    { minLength: 0, maxLength: 8 }
                ),
                (rows) => {
                    const ref = { existingCardUids: new Set(), today: TODAY };
                    const errors = validateSubRows(rows, ref);
                    for (const e of errors) {
                        expect(typeof e.row).toBe("number");
                        expect(typeof e.field).toBe("string");
                        expect(typeof e.reason).toBe("string");
                        expect(e.reason.length).toBeGreaterThan(0);
                    }
                }
            ),
            { numRuns: 100 }
        );
    });
});
