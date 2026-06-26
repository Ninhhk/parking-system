const ExcelJS = require("exceljs");
const constants = require("../config/constants");

// Fixed column specs per entity
const CARD_COLUMNS = ["card_uid", "lot_id", "status"];
const SUB_COLUMNS = ["card_uid", "monthly_end_date", "holder_name", "holder_phone", "license_plate", "vehicle_type", "action"];

/**
 * Format a JS Date to YYYY-MM-DD string.
 */
function formatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

/**
 * Coerce an ExcelJS cell value to a string.
 * - Valid Date objects → "YYYY-MM-DD"
 * - Invalid Date → ""
 * - null/undefined → ""
 * - Everything else → trimmed string
 */
function coerceCell(value) {
    if (value == null) return "";
    if (value instanceof Date) {
        if (isNaN(value.getTime())) return "";
        return formatDate(value);
    }
    // ExcelJS rich text: { richText: [...] }
    if (typeof value === "object" && value.richText) {
        return value.richText.map((r) => r.text || "").join("").trim();
    }
    // ExcelJS formula result
    if (typeof value === "object" && value.result !== undefined) {
        return coerceCell(value.result);
    }
    let str = String(value).trim();
    // Strip Excel text-format prefix apostrophe (used to preserve leading zeros)
    if (str.startsWith("'") && str.length > 1) {
        str = str.substring(1);
    }
    // A lone apostrophe is effectively empty
    if (str === "'") {
        return "";
    }
    return str;
}

/**
 * Parse an .xlsx buffer into an array of row objects keyed by the column spec.
 *
 * - Reads the first worksheet.
 * - Header row is row 1 (used for alignment but column order follows `columns` param).
 * - Data rows start at row 2; each parsed object carries `__row` (1-based excel row number).
 * - Coerces cells: ExcelJS Date → "YYYY-MM-DD"; everything else → trimmed string; blank → "".
 * - Throws { code: "ROW_LIMIT_EXCEEDED" } when data rows > MAX_IMPORT_ROWS.
 *
 * @param {Buffer} buffer - The .xlsx file buffer
 * @param {string[]} columns - Column keys in order
 * @returns {Promise<Array<Object>>} Array of row objects
 */
async function parseWorkbook(buffer, columns) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
        return [];
    }

    const rows = [];
    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber === 1) return; // skip header
        const obj = { __row: rowNumber };
        columns.forEach((col, idx) => {
            obj[col] = coerceCell(row.getCell(idx + 1).value);
        });
        // Skip effectively-empty rows (all columns empty after coercion)
        const hasData = columns.some(col => obj[col] !== "");
        if (!hasData) return;
        rows.push(obj);
    });

    if (rows.length > constants.MAX_IMPORT_ROWS) {
        const err = new Error(
            `Import file exceeds the maximum of ${constants.MAX_IMPORT_ROWS} data rows`
        );
        err.code = "ROW_LIMIT_EXCEEDED";
        throw err;
    }

    return rows;
}

module.exports = {
    parseWorkbook,
    CARD_COLUMNS,
    SUB_COLUMNS,
};
