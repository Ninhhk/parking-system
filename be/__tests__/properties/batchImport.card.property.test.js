const fc = require("fast-check");
const { validateCardRows, ALLOWED_CARD_STATUS } = require("../../services/batchImport.service");

/**
 * Helper: generate a valid card_uid (non-empty alphanumeric string).
 */
const arbCardUid = fc.string({ minLength: 1, maxLength: 20 })
    .filter(s => s.trim().length > 0);

/**
 * Helper: generate a status that is NOT in ALLOWED_CARD_STATUS.
 */
const arbInvalidStatus = fc.string({ minLength: 1, maxLength: 15 })
    .filter(s => s.trim().length > 0 && !ALLOWED_CARD_STATUS.includes(s.toLowerCase()));

/**
 * Helper: generate a valid lot_id as a string number.
 */
const arbLotId = fc.integer({ min: 1, max: 9999 }).map(String);

// Feature: batch-import-export, Property 2: Card field and status validation flags exactly the offending rows
// **Validates: Requirements 1.2, 1.3, 1.4**
describe("Feature: batch-import-export, Property 2: Card field and status validation flags exactly the offending rows", () => {
    it("flags rows missing card_uid", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 2, max: 100 }),
                (rowNum) => {
                    const rows = [{ __row: rowNum, card_uid: "", lot_id: "", status: "" }];
                    const ref = { existingLotIds: new Set(), existingCardUids: new Set() };
                    const errors = validateCardRows(rows, ref);
                    const uidErrors = errors.filter(e => e.field === "card_uid" && e.row === rowNum);
                    expect(uidErrors.length).toBeGreaterThanOrEqual(1);
                    expect(uidErrors[0].reason).toContain("required");
                }
            ),
            { numRuns: 100 }
        );
    });

    it("flags rows with invalid non-blank status", () => {
        fc.assert(
            fc.property(
                arbCardUid,
                arbInvalidStatus,
                fc.integer({ min: 2, max: 100 }),
                (uid, badStatus, rowNum) => {
                    const rows = [{ __row: rowNum, card_uid: uid, lot_id: "", status: badStatus }];
                    const ref = { existingLotIds: new Set(), existingCardUids: new Set() };
                    const errors = validateCardRows(rows, ref);
                    const statusErrors = errors.filter(e => e.field === "status" && e.row === rowNum);
                    expect(statusErrors.length).toBe(1);
                    expect(statusErrors[0].reason).toContain("status must be one of");
                }
            ),
            { numRuns: 100 }
        );
    });

    it("never flags blank status (defaults to available)", () => {
        fc.assert(
            fc.property(
                arbCardUid,
                fc.integer({ min: 2, max: 100 }),
                (uid, rowNum) => {
                    const rows = [{ __row: rowNum, card_uid: uid, lot_id: "", status: "" }];
                    const ref = { existingLotIds: new Set(), existingCardUids: new Set() };
                    const errors = validateCardRows(rows, ref);
                    const statusErrors = errors.filter(e => e.field === "status");
                    expect(statusErrors.length).toBe(0);
                }
            ),
            { numRuns: 100 }
        );
    });

    it("never flags valid status values", () => {
        fc.assert(
            fc.property(
                arbCardUid,
                fc.constantFrom(...ALLOWED_CARD_STATUS),
                fc.integer({ min: 2, max: 100 }),
                (uid, validStatus, rowNum) => {
                    const rows = [{ __row: rowNum, card_uid: uid, lot_id: "", status: validStatus }];
                    const ref = { existingLotIds: new Set(), existingCardUids: new Set() };
                    const errors = validateCardRows(rows, ref);
                    const statusErrors = errors.filter(e => e.field === "status");
                    expect(statusErrors.length).toBe(0);
                }
            ),
            { numRuns: 100 }
        );
    });

    it("never flags blank lot_id", () => {
        fc.assert(
            fc.property(
                arbCardUid,
                fc.integer({ min: 2, max: 100 }),
                (uid, rowNum) => {
                    const rows = [{ __row: rowNum, card_uid: uid, lot_id: "", status: "" }];
                    const ref = { existingLotIds: new Set(), existingCardUids: new Set() };
                    const errors = validateCardRows(rows, ref);
                    const lotErrors = errors.filter(e => e.field === "lot_id");
                    expect(lotErrors.length).toBe(0);
                }
            ),
            { numRuns: 100 }
        );
    });
});

// Feature: batch-import-export, Property 3: Card reference validation flags unknown lots and existing/duplicate cards
// **Validates: Requirements 1.5, 1.6, 1.7, 1.8**
describe("Feature: batch-import-export, Property 3: Card reference validation flags unknown lots and existing/duplicate cards", () => {
    it("flags non-blank lot_id absent from existing lots", () => {
        fc.assert(
            fc.property(
                arbCardUid,
                arbLotId,
                fc.integer({ min: 2, max: 100 }),
                (uid, lotId, rowNum) => {
                    const rows = [{ __row: rowNum, card_uid: uid, lot_id: lotId, status: "" }];
                    // existingLotIds does NOT contain this lotId
                    const ref = { existingLotIds: new Set(), existingCardUids: new Set() };
                    const errors = validateCardRows(rows, ref);
                    const lotErrors = errors.filter(e => e.field === "lot_id" && e.row === rowNum);
                    expect(lotErrors.length).toBe(1);
                    expect(lotErrors[0].reason).toContain("does not exist");
                }
            ),
            { numRuns: 100 }
        );
    });

    it("does not flag non-blank lot_id that exists", () => {
        fc.assert(
            fc.property(
                arbCardUid,
                fc.integer({ min: 1, max: 9999 }),
                fc.integer({ min: 2, max: 100 }),
                (uid, lotIdNum, rowNum) => {
                    const lotId = String(lotIdNum);
                    const rows = [{ __row: rowNum, card_uid: uid, lot_id: lotId, status: "" }];
                    const ref = { existingLotIds: new Set([lotIdNum]), existingCardUids: new Set() };
                    const errors = validateCardRows(rows, ref);
                    const lotErrors = errors.filter(e => e.field === "lot_id");
                    expect(lotErrors.length).toBe(0);
                }
            ),
            { numRuns: 100 }
        );
    });

    it("flags card_uid that already exists in DB", () => {
        fc.assert(
            fc.property(
                arbCardUid,
                fc.integer({ min: 2, max: 100 }),
                (uid, rowNum) => {
                    const rows = [{ __row: rowNum, card_uid: uid, lot_id: "", status: "" }];
                    const ref = { existingLotIds: new Set(), existingCardUids: new Set([uid]) };
                    const errors = validateCardRows(rows, ref);
                    const dupErrors = errors.filter(
                        e => e.field === "card_uid" && e.reason.includes("already exists in database")
                    );
                    expect(dupErrors.length).toBe(1);
                }
            ),
            { numRuns: 100 }
        );
    });

    it("flags in-file duplicate card_uid (second occurrence)", () => {
        fc.assert(
            fc.property(
                arbCardUid,
                fc.integer({ min: 2, max: 50 }),
                (uid, baseRow) => {
                    const rows = [
                        { __row: baseRow, card_uid: uid, lot_id: "", status: "" },
                        { __row: baseRow + 1, card_uid: uid, lot_id: "", status: "" },
                    ];
                    const ref = { existingLotIds: new Set(), existingCardUids: new Set() };
                    const errors = validateCardRows(rows, ref);
                    const dupErrors = errors.filter(
                        e => e.field === "card_uid" && e.reason.includes("duplicate card_uid in file")
                    );
                    // Only the second occurrence is flagged
                    expect(dupErrors.length).toBe(1);
                    expect(dupErrors[0].row).toBe(baseRow + 1);
                }
            ),
            { numRuns: 100 }
        );
    });
});

// Feature: batch-import-export, Property 7: Every reported error is well-formed and traceable
// **Validates: Requirements 6.1**
describe("Feature: batch-import-export, Property 7: Every reported error is well-formed and traceable", () => {
    it("every error has integer row and non-empty reason", () => {
        fc.assert(
            fc.property(
                fc.array(
                    fc.record({
                        __row: fc.integer({ min: 2, max: 5000 }),
                        card_uid: fc.oneof(fc.constant(""), arbCardUid),
                        lot_id: fc.oneof(fc.constant(""), arbLotId),
                        status: fc.oneof(fc.constant(""), fc.string({ minLength: 1, maxLength: 10 })),
                    }),
                    { minLength: 1, maxLength: 20 }
                ),
                fc.set(fc.integer({ min: 1, max: 9999 }), { minLength: 0, maxLength: 5 }),
                fc.set(arbCardUid, { minLength: 0, maxLength: 5 }),
                (rows, lotIdArr, existingUidArr) => {
                    const ref = {
                        existingLotIds: new Set(lotIdArr),
                        existingCardUids: new Set(existingUidArr),
                    };
                    const errors = validateCardRows(rows, ref);
                    for (const err of errors) {
                        expect(typeof err.row).toBe("number");
                        expect(Number.isInteger(err.row)).toBe(true);
                        expect(err.row).toBeGreaterThanOrEqual(2);
                        expect(typeof err.reason).toBe("string");
                        expect(err.reason.length).toBeGreaterThan(0);
                    }
                }
            ),
            { numRuns: 100 }
        );
    });
});

// Feature: batch-import-export, Property 8: Validation reports all offending rows, not just the first
// **Validates: Requirements 1.10, 2.7, 3.7, 6.1**
describe("Feature: batch-import-export, Property 8: Validation reports all offending rows, not just the first", () => {
    it("all rows missing card_uid are reported", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 2, max: 10 }),
                (count) => {
                    const rows = Array.from({ length: count }, (_, i) => ({
                        __row: i + 2,
                        card_uid: "",
                        lot_id: "",
                        status: "",
                    }));
                    const ref = { existingLotIds: new Set(), existingCardUids: new Set() };
                    const errors = validateCardRows(rows, ref);
                    // Every row should have at least one error (missing card_uid)
                    const errorRows = new Set(errors.map(e => e.row));
                    for (const row of rows) {
                        expect(errorRows.has(row.__row)).toBe(true);
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    it("multiple different error types across rows are all reported", () => {
        fc.assert(
            fc.property(
                arbCardUid,
                arbInvalidStatus,
                arbLotId,
                (uid, badStatus, unknownLot) => {
                    const rows = [
                        { __row: 2, card_uid: "", lot_id: "", status: "" },           // missing uid
                        { __row: 3, card_uid: uid, lot_id: "", status: badStatus },   // bad status
                        { __row: 4, card_uid: uid + "x", lot_id: unknownLot, status: "" }, // unknown lot
                    ];
                    const ref = { existingLotIds: new Set(), existingCardUids: new Set() };
                    const errors = validateCardRows(rows, ref);
                    const errorRows = new Set(errors.map(e => e.row));
                    // All three rows should be flagged
                    expect(errorRows.has(2)).toBe(true);
                    expect(errorRows.has(3)).toBe(true);
                    expect(errorRows.has(4)).toBe(true);
                }
            ),
            { numRuns: 100 }
        );
    });
});
