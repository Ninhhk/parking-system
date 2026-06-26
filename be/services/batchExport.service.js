const ExcelJS = require("exceljs");

const SESSION_COLUMNS = [
    "session_id", "lot_id", "license_plate", "card_uid", "etag_epc",
    "entry_lane_id", "vehicle_type", "time_in", "time_out", "image_in_url",
    "image_out_url", "is_lost", "is_monthly", "parking_fee"
];

const PAYMENT_COLUMNS = [
    "payment_id", "session_id", "payment_date",
    "payment_method", "total_amount"
];

const CARD_EXPORT_COLUMNS = ["card_uid", "lot_id", "status"];

const SUB_EXPORT_COLUMNS = [
    "card_uid", "monthly_end_date", "holder_name", "holder_phone",
    "license_plate", "vehicle_type", "action"
];

/**
 * Build an in-memory ExcelJS workbook and return it as a Buffer.
 * Header row = columns, one data row per input row.
 */
async function buildWorkbookBuffer(rows, columns) {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Export");
    sheet.addRow(columns);
    for (const row of rows) {
        sheet.addRow(columns.map(col => row[col] ?? ""));
    }
    return workbook.xlsx.writeBuffer();
}

module.exports = { buildWorkbookBuffer, SESSION_COLUMNS, PAYMENT_COLUMNS, SUB_EXPORT_COLUMNS, CARD_EXPORT_COLUMNS };
