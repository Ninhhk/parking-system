const fc = require("fast-check");
const ExcelJS = require("exceljs");
const { buildWorkbookBuffer, SESSION_COLUMNS, PAYMENT_COLUMNS } = require("../../services/batchExport.service");

/**
 * Feature: batch-import-export, Property 10: Export workbook contains the required columns and one row per record
 * Validates: Requirements 4.1, 5.1
 */
describe("Feature: batch-import-export, Property 10: Export workbook contains the required columns and one row per record", () => {
    /**
     * Arbitrary generator: produces an array of row objects (1-50 rows)
     * with keys matching the given column spec.
     */
    function rowsArb(columns) {
        const rowArb = fc.record(
            Object.fromEntries(
                columns.map(col => [col, fc.oneof(
                    fc.string({ minLength: 0, maxLength: 30 }),
                    fc.integer({ min: 0, max: 99999 }).map(String),
                    fc.constant("")
                )])
            )
        );
        return fc.array(rowArb, { minLength: 1, maxLength: 50 });
    }

    it("header row matches columns and row count matches input (SESSION_COLUMNS)", async () => {
        await fc.assert(
            fc.asyncProperty(
                rowsArb(SESSION_COLUMNS),
                async (rows) => {
                    const buffer = await buildWorkbookBuffer(rows, SESSION_COLUMNS);

                    // Parse back
                    const workbook = new ExcelJS.Workbook();
                    await workbook.xlsx.load(buffer);
                    const sheet = workbook.worksheets[0];

                    // Header row (row 1) matches columns
                    const headerRow = sheet.getRow(1);
                    const headers = [];
                    headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                        headers.push(cell.value);
                    });
                    expect(headers).toEqual(SESSION_COLUMNS);

                    // Data row count matches input
                    // Total rows = header (1) + data rows
                    expect(sheet.rowCount).toBe(rows.length + 1);

                    // Each data row maps back to original values
                    for (let i = 0; i < rows.length; i++) {
                        const dataRow = sheet.getRow(i + 2);
                        for (let colIdx = 0; colIdx < SESSION_COLUMNS.length; colIdx++) {
                            const col = SESSION_COLUMNS[colIdx];
                            const cellValue = dataRow.getCell(colIdx + 1).value;
                            const expected = rows[i][col] ?? "";
                            // ExcelJS may store numbers; coerce both to string for comparison
                            expect(String(cellValue ?? "")).toBe(String(expected));
                        }
                    }
                }
            ),
            { numRuns: 100 }
        );
    }, 60000);

    it("header row matches columns and row count matches input (PAYMENT_COLUMNS)", async () => {
        await fc.assert(
            fc.asyncProperty(
                rowsArb(PAYMENT_COLUMNS),
                async (rows) => {
                    const buffer = await buildWorkbookBuffer(rows, PAYMENT_COLUMNS);

                    const workbook = new ExcelJS.Workbook();
                    await workbook.xlsx.load(buffer);
                    const sheet = workbook.worksheets[0];

                    // Header row
                    const headerRow = sheet.getRow(1);
                    const headers = [];
                    headerRow.eachCell({ includeEmpty: true }, (cell) => {
                        headers.push(cell.value);
                    });
                    expect(headers).toEqual(PAYMENT_COLUMNS);

                    // Data row count
                    expect(sheet.rowCount).toBe(rows.length + 1);

                    // Round-trip values
                    for (let i = 0; i < rows.length; i++) {
                        const dataRow = sheet.getRow(i + 2);
                        for (let colIdx = 0; colIdx < PAYMENT_COLUMNS.length; colIdx++) {
                            const col = PAYMENT_COLUMNS[colIdx];
                            const cellValue = dataRow.getCell(colIdx + 1).value;
                            const expected = rows[i][col] ?? "";
                            expect(String(cellValue ?? "")).toBe(String(expected));
                        }
                    }
                }
            ),
            { numRuns: 100 }
        );
    }, 60000);
});
