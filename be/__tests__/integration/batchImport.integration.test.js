// Integration tests for Batch Import/Export (batch-import-export spec).
// Exercises commitCards, commitSubs, commitStatus, and export date-range filtering
// against Docker Postgres (no mocks).
//
// Requires Docker Postgres on port 55432; run with:
//   DB_HOST=localhost DB_PORT=55432 DB_USER=admin DB_PASSWORD=password123 \
//     DB_NAME=parking_lot npx jest batchImport.integration --runInBand --forceExit
//
// Validates: Requirements 1.9, 1.10, 2.4, 2.5, 2.7, 3.4, 3.6, 3.7, 4.2, 5.2, 7.1, 7.2, 7.3

const { pool } = require("../../config/db");
const ExcelJS = require("exceljs");
const batchImportService = require("../../services/batchImport.service");
const batchExportRepo = require("../../repositories/batchExport.repo");

const PREFIX = "TEST_BATCH_";

/**
 * Build an .xlsx buffer from column headers and data rows.
 */
async function buildBuffer(columns, dataRows) {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Sheet1");
    sheet.addRow(columns);
    for (const row of dataRows) sheet.addRow(row);
    return workbook.xlsx.writeBuffer();
}

describe("Batch Import Integration", () => {
    let testLotId;

    beforeAll(async () => {
        // Create a test lot for FK checks
        const res = await pool.query(
            `INSERT INTO parkinglots (lot_name, car_capacity, bike_capacity, managed_by)
             VALUES ('Test Lot Batch', 50, 50, NULL)
             ON CONFLICT DO NOTHING
             RETURNING lot_id`
        );
        if (res.rows.length > 0) {
            testLotId = res.rows[0].lot_id;
        } else {
            const lookup = await pool.query(
                "SELECT lot_id FROM parkinglots WHERE lot_name = 'Test Lot Batch'"
            );
            testLotId = lookup.rows[0].lot_id;
        }
    });

    afterAll(async () => {
        await pool.query("DELETE FROM parking_cards WHERE card_uid LIKE $1", [`${PREFIX}%`]);
        await pool.query("DELETE FROM parkingsessions WHERE license_plate LIKE $1", [`${PREFIX}%`]);
        await pool.query("DELETE FROM payment WHERE session_id IN (SELECT session_id FROM parkingsessions WHERE license_plate LIKE $1)", [`${PREFIX}%`]);
        await pool.query("DELETE FROM parkinglots WHERE lot_name = 'Test Lot Batch'");
        await pool.end();
    });

    // ─── Card commit ───────────────────────────────────────────────────────────

    describe("Card commit", () => {
        afterEach(async () => {
            await pool.query("DELETE FROM parking_cards WHERE card_uid LIKE $1", [`${PREFIX}CARD_%`]);
        });

        it("inserts all rows on valid batch (Req 1.9, 7.1)", async () => {
            const buffer = await buildBuffer(
                ["card_uid", "lot_id", "status"],
                [
                    [`${PREFIX}CARD_A`, String(testLotId), "available"],
                    [`${PREFIX}CARD_B`, "", ""],  // shared card, default status
                    [`${PREFIX}CARD_C`, String(testLotId), "lost"],
                ]
            );

            const result = await batchImportService.commitCards(buffer);
            expect(result.committed).toBe(true);
            expect(result.count).toBe(3);

            // Verify rows actually exist in DB
            const dbRows = await pool.query(
                "SELECT card_uid, lot_id, status FROM parking_cards WHERE card_uid LIKE $1 ORDER BY card_uid",
                [`${PREFIX}CARD_%`]
            );
            expect(dbRows.rows).toHaveLength(3);
            expect(dbRows.rows[0]).toMatchObject({ card_uid: `${PREFIX}CARD_A`, lot_id: testLotId, status: "available" });
            expect(dbRows.rows[1]).toMatchObject({ card_uid: `${PREFIX}CARD_B`, lot_id: null, status: "available" });
            expect(dbRows.rows[2]).toMatchObject({ card_uid: `${PREFIX}CARD_C`, lot_id: testLotId, status: "lost" });
        });

        it("persists zero rows on invalid batch (Req 1.10, 7.2)", async () => {
            const buffer = await buildBuffer(
                ["card_uid", "lot_id", "status"],
                [
                    [`${PREFIX}CARD_OK`, String(testLotId), "available"],
                    ["", "", ""],  // missing card_uid → error
                ]
            );

            const result = await batchImportService.commitCards(buffer);
            expect(result.committed).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);

            // Verify the valid row was NOT persisted (all-or-nothing)
            const dbRows = await pool.query(
                "SELECT card_uid FROM parking_cards WHERE card_uid = $1",
                [`${PREFIX}CARD_OK`]
            );
            expect(dbRows.rows).toHaveLength(0);
        });

        it("surfaces duplicate errors on re-commit (Req 7.3)", async () => {
            const buffer = await buildBuffer(
                ["card_uid", "lot_id", "status"],
                [[`${PREFIX}CARD_DUP`, String(testLotId), "available"]]
            );

            // First commit succeeds
            const first = await batchImportService.commitCards(buffer);
            expect(first.committed).toBe(true);

            // Second commit with same data surfaces duplicate error
            const second = await batchImportService.commitCards(buffer);
            expect(second.committed).toBe(false);
            expect(second.errors.length).toBeGreaterThan(0);
            // The existing card_uid should be flagged
            const dupError = second.errors.find(e => e.field === "card_uid");
            expect(dupError).toBeDefined();
        });
    });

    // ─── Subscription commit (monthly enable on pool cards) ──────────────────────

    describe("Subscription commit", () => {
        afterEach(async () => {
            await pool.query("DELETE FROM parking_cards WHERE card_uid LIKE $1", [`${PREFIX}SUB_%`]);
        });

        it("enables monthly on existing cards atomically (Req 2.7 atomic)", async () => {
            // Seed two pool cards first (monthly enable operates on existing cards)
            await pool.query(
                "INSERT INTO parking_cards (card_uid, lot_id, status) VALUES ($1, $2, 'available'), ($3, $4, 'available')",
                [`${PREFIX}SUB_A`, testLotId, `${PREFIX}SUB_B`, null]
            );

            const buffer = await buildBuffer(
                ["card_uid", "monthly_end_date"],
                [
                    [`${PREFIX}SUB_A`, "2099-02-01"],
                    [`${PREFIX}SUB_B`, "2099-04-01"],
                ]
            );

            const result = await batchImportService.commitSubs(buffer);
            expect(result.committed).toBe(true);
            expect(result.count).toBe(2);

            const dbRows = await pool.query(
                "SELECT card_uid, is_monthly, monthly_end_date::text AS monthly_end_date FROM parking_cards WHERE card_uid LIKE $1 ORDER BY card_uid",
                [`${PREFIX}SUB_%`]
            );
            expect(dbRows.rows).toHaveLength(2);
            expect(dbRows.rows[0]).toMatchObject({ card_uid: `${PREFIX}SUB_A`, is_monthly: true, monthly_end_date: "2099-02-01" });
            expect(dbRows.rows[1]).toMatchObject({ card_uid: `${PREFIX}SUB_B`, is_monthly: true, monthly_end_date: "2099-04-01" });
        });

        it("rejects card_uid that is not in the card pool (Req 2.4)", async () => {
            const buffer = await buildBuffer(
                ["card_uid", "monthly_end_date"],
                [[`${PREFIX}SUB_MISSING`, "2099-02-01"]]
            );

            const result = await batchImportService.commitSubs(buffer);
            expect(result.committed).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors[0].reason).toContain("does not exist");
        });

        it("persists zero rows on invalid batch - all-or-nothing (Req 2.5)", async () => {
            // Seed only one of the two cards
            await pool.query(
                "INSERT INTO parking_cards (card_uid, lot_id, status) VALUES ($1, $2, 'available')",
                [`${PREFIX}SUB_OK`, testLotId]
            );

            const buffer = await buildBuffer(
                ["card_uid", "monthly_end_date"],
                [
                    [`${PREFIX}SUB_OK`, "2099-02-01"],        // valid
                    [`${PREFIX}SUB_GONE`, "2099-03-01"],      // not in pool → error
                ]
            );

            const result = await batchImportService.commitSubs(buffer);
            expect(result.committed).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);

            // The valid row must NOT have been applied
            const dbRow = await pool.query(
                "SELECT is_monthly FROM parking_cards WHERE card_uid = $1",
                [`${PREFIX}SUB_OK`]
            );
            expect(dbRow.rows[0].is_monthly).toBe(false);
        });
    });

    // ─── Status-update commit (renew/cancel on pool cards) ───────────────────────

    describe("Status-update commit", () => {
        beforeEach(async () => {
            // Seed two monthly cards to operate on
            await pool.query(
                `INSERT INTO parking_cards (card_uid, lot_id, status, is_monthly, monthly_end_date)
                 VALUES ($1, $2, 'available', true, '2099-03-01'),
                        ($3, $4, 'available', true, '2099-02-01')`,
                [`${PREFIX}STATUS_RENEW`, testLotId, `${PREFIX}STATUS_CANCEL`, testLotId]
            );
        });

        afterEach(async () => {
            await pool.query("DELETE FROM parking_cards WHERE card_uid LIKE $1", [`${PREFIX}STATUS_%`]);
        });

        it("renew extends monthly_end_date (Req 3.4)", async () => {
            const buffer = await buildBuffer(
                ["card_uid", "action", "new_end_date"],
                [[`${PREFIX}STATUS_RENEW`, "renew", "2099-06-01"]]
            );

            const result = await batchImportService.commitStatus(buffer);
            expect(result.committed).toBe(true);

            const dbRow = await pool.query(
                "SELECT is_monthly, monthly_end_date::text AS monthly_end_date FROM parking_cards WHERE card_uid = $1",
                [`${PREFIX}STATUS_RENEW`]
            );
            expect(dbRow.rows[0]).toMatchObject({ is_monthly: true, monthly_end_date: "2099-06-01" });
        });

        it("cancel clears is_monthly and monthly_end_date (Req 3.6)", async () => {
            const buffer = await buildBuffer(
                ["card_uid", "action", "new_end_date"],
                [[`${PREFIX}STATUS_CANCEL`, "cancel", ""]]
            );

            const result = await batchImportService.commitStatus(buffer);
            expect(result.committed).toBe(true);

            const dbRow = await pool.query(
                "SELECT is_monthly, monthly_end_date FROM parking_cards WHERE card_uid = $1",
                [`${PREFIX}STATUS_CANCEL`]
            );
            expect(dbRow.rows[0].is_monthly).toBe(false);
            expect(dbRow.rows[0].monthly_end_date).toBeNull();
        });

        it("rollback on invalid batch - unknown card_uid (Req 3.7, 7.2)", async () => {
            const buffer = await buildBuffer(
                ["card_uid", "action", "new_end_date"],
                [
                    [`${PREFIX}STATUS_RENEW`, "renew", "2099-06-01"],  // valid
                    [`${PREFIX}STATUS_GHOST`, "renew", "2099-12-01"],  // not in pool
                ]
            );

            const result = await batchImportService.commitStatus(buffer);
            expect(result.committed).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);

            // Valid row should NOT have been applied (all-or-nothing)
            const dbRow = await pool.query(
                "SELECT monthly_end_date::text AS monthly_end_date FROM parking_cards WHERE card_uid = $1",
                [`${PREFIX}STATUS_RENEW`]
            );
            expect(dbRow.rows[0].monthly_end_date).toBe("2099-03-01"); // unchanged
        });
    });

    // ─── Export date-range filter ──────────────────────────────────────────────

    describe("Export date-range filter", () => {
        let testSessionId;

        beforeAll(async () => {
            // Insert test session
            const sRes = await pool.query(
                `INSERT INTO parkingsessions (lot_id, license_plate, vehicle_type, time_in, time_out, parking_fee)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 RETURNING session_id`,
                [testLotId, `${PREFIX}EXPORT_LP`, "car", "2025-02-15 10:00:00", "2025-02-15 12:00:00", 20000]
            );
            testSessionId = sRes.rows[0].session_id;

            // Insert test payment
            await pool.query(
                `INSERT INTO payment (session_id, payment_date, payment_method, total_amount)
                 VALUES ($1, $2, $3, $4)`,
                [testSessionId, "2025-02-15", "CASH", 20000]
            );
        });

        afterAll(async () => {
            await pool.query("DELETE FROM payment WHERE session_id = $1", [testSessionId]);
            await pool.query("DELETE FROM parkingsessions WHERE session_id = $1", [testSessionId]);
        });

        it("filters sessions by time_in date range (Req 4.2)", async () => {
            // Range that includes our test session
            const included = await batchExportRepo.getSessionsForExport({ from: "2025-02-01", to: "2025-02-28" });
            const found = included.find(r => r.session_id === testSessionId);
            expect(found).toBeDefined();
            expect(found.license_plate).toBe(`${PREFIX}EXPORT_LP`);

            // Range that excludes our test session
            const excluded = await batchExportRepo.getSessionsForExport({ from: "2025-03-01", to: "2025-03-31" });
            const notFound = excluded.find(r => r.session_id === testSessionId);
            expect(notFound).toBeUndefined();
        });

        it("filters payments by payment_date date range (Req 5.2)", async () => {
            // Range that includes our test payment
            const included = await batchExportRepo.getPaymentsForExport({ from: "2025-02-01", to: "2025-02-28" });
            const found = included.find(r => r.session_id === testSessionId);
            expect(found).toBeDefined();
            expect(found.total_amount).toBe(20000);

            // Range that excludes our test payment
            const excluded = await batchExportRepo.getPaymentsForExport({ from: "2025-04-01", to: "2025-04-30" });
            const notFound = excluded.find(r => r.session_id === testSessionId);
            expect(notFound).toBeUndefined();
        });
    });
});
