const fc = require("fast-check");
const ExcelJS = require("exceljs");
const { parseWorkbook, CARD_COLUMNS } = require("../../services/xlsx.helper");
const { MAX_IMPORT_ROWS } = require("../../config/constants");

/**
 * Helper: build an .xlsx buffer from an array of row arrays.
 * First row is the header (column names), subsequent rows are data.
 */
async function buildBuffer(columns, dataRows) {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Sheet1");
    sheet.addRow(columns);
    for (const row of dataRows) {
        sheet.addRow(row);
    }
    return workbook.xlsx.writeBuffer();
}

// Feature: batch-import-export, Property 1: Parse maps every data row to one keyed object
// Validates: Requirements 1.1, 2.1, 3.1, 6.3, 7.4
describe("Feature: batch-import-export, Property 1: Parse maps every data row to one keyed object", () => {
    it("parseWorkbook returns exactly N objects each with __row and all column keys", async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.array(
                    fc.tuple(
                        fc.string({ minLength: 1, maxLength: 20 }),
                        fc.string({ maxLength: 10 }),
                        fc.string({ maxLength: 10 })
                    ),
                    { minLength: 1, maxLength: 50 }
                ),
                async (dataRows) => {
                    const buffer = await buildBuffer(CARD_COLUMNS, dataRows);
                    const result = await parseWorkbook(buffer, CARD_COLUMNS);

                    // Exactly N row objects
                    expect(result.length).toBe(dataRows.length);

                    for (let i = 0; i < result.length; i++) {
                        const obj = result[i];
                        // Each object has __row (1-based excel row; data starts at row 2)
                        expect(obj.__row).toBe(i + 2);
                        // Each object has all column keys
                        for (const col of CARD_COLUMNS) {
                            expect(obj).toHaveProperty(col);
                            expect(typeof obj[col]).toBe("string");
                        }
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    it("parseWorkbook coerces Date cells to YYYY-MM-DD strings", async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.date({
                    min: new Date("2000-01-01T00:00:00.000Z"),
                    max: new Date("2099-12-31T23:59:59.999Z"),
                }).filter((d) => !isNaN(d.getTime())),
                async (date) => {
                    const columns = ["date_col"];
                    const workbook = new ExcelJS.Workbook();
                    const sheet = workbook.addWorksheet("Sheet1");
                    sheet.addRow(columns);
                    sheet.addRow([date]);
                    const buffer = await workbook.xlsx.writeBuffer();

                    const result = await parseWorkbook(buffer, columns);

                    expect(result.length).toBe(1);
                    // Should be YYYY-MM-DD format
                    expect(result[0].date_col).toMatch(/^\d{4}-\d{2}-\d{2}$/);
                }
            ),
            { numRuns: 100 }
        );
    });

    it("parseWorkbook maps blank cells to empty string", async () => {
        const columns = ["a", "b"];
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet("Sheet1");
        sheet.addRow(columns);
        sheet.addRow(["value", null]);
        const buffer = await workbook.xlsx.writeBuffer();

        const result = await parseWorkbook(buffer, columns);
        expect(result[0].b).toBe("");
    });
});

// Feature: batch-import-export, Property 11: Row-count limit is enforced at the boundary
// Validates: Requirements 6.3, 7.4
describe("Feature: batch-import-export, Property 11: Row-count limit is enforced at the boundary", () => {
    // Property test with a smaller limit (50) to keep workbook generation fast.
    // The property: parse succeeds iff rowCount <= limit; throws ROW_LIMIT_EXCEEDED otherwise.
    it("parse succeeds when rows <= limit and throws ROW_LIMIT_EXCEEDED when rows > limit", async () => {
        const SMALL_LIMIT = 50;
        const constants = require("../../config/constants");
        const saved = constants.MAX_IMPORT_ROWS;
        constants.MAX_IMPORT_ROWS = SMALL_LIMIT;

        try {
            await fc.assert(
                fc.asyncProperty(
                    fc.integer({ min: SMALL_LIMIT - 5, max: SMALL_LIMIT + 5 }),
                    async (rowCount) => {
                        const columns = ["col1"];
                        const dataRows = Array.from({ length: rowCount }, (_, i) => [
                            `val${i}`,
                        ]);
                        const buffer = await buildBuffer(columns, dataRows);

                        if (rowCount <= SMALL_LIMIT) {
                            const result = await parseWorkbook(buffer, columns);
                            expect(result.length).toBe(rowCount);
                        } else {
                            await expect(
                                parseWorkbook(buffer, columns)
                            ).rejects.toMatchObject({ code: "ROW_LIMIT_EXCEEDED" });
                        }
                    }
                ),
                { numRuns: 100 }
            );
        } finally {
            constants.MAX_IMPORT_ROWS = saved;
        }
    }, 60000);

    // Explicit boundary tests at the real MAX_IMPORT_ROWS (5000)
    it("accepts exactly MAX_IMPORT_ROWS rows", async () => {
        const columns = ["col1"];
        const dataRows = Array.from({ length: MAX_IMPORT_ROWS }, (_, i) => [`v${i}`]);
        const buffer = await buildBuffer(columns, dataRows);
        const result = await parseWorkbook(buffer, columns);
        expect(result.length).toBe(MAX_IMPORT_ROWS);
    }, 60000);

    it("rejects MAX_IMPORT_ROWS + 1 rows with ROW_LIMIT_EXCEEDED", async () => {
        const columns = ["col1"];
        const dataRows = Array.from({ length: MAX_IMPORT_ROWS + 1 }, (_, i) => [`v${i}`]);
        const buffer = await buildBuffer(columns, dataRows);
        await expect(parseWorkbook(buffer, columns)).rejects.toMatchObject({
            code: "ROW_LIMIT_EXCEEDED",
        });
    }, 60000);
});
