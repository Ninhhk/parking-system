const batchImportService = require("../services/batchImport.service");
const batchExportService = require("../services/batchExport.service");
const batchExportRepo = require("../repositories/batchExport.repo");
const { CARD_COLUMNS, SUB_COLUMNS } = require("../services/xlsx.helper");

// Human-readable header labels for templates (positional — must match *_COLUMNS order)
const TEMPLATE_HEADERS = {
    cards: ["Card UID", "Lot ID", "Status"],
    subs: ["Card UID", "Monthly End Date", "Holder Name", "Holder Phone", "License Plate", "Vehicle Type", "Action"],
};

exports.downloadTemplate = async (req, res) => {
    const { entity } = req.params;
    const columnMap = {
        cards: CARD_COLUMNS,
        subs: SUB_COLUMNS,
    };
    const columns = columnMap[entity];
    if (!columns) {
        return res.status(422).json({ success: false, message: "Invalid entity type" });
    }
    try {
        const ExcelJS = require("exceljs");
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet("Template");
        sheet.addRow(TEMPLATE_HEADERS[entity] || columns);
        const buffer = await workbook.xlsx.writeBuffer();
        res.set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.set("Content-Disposition", `attachment; filename="${entity}_template.xlsx"`);
        return res.send(Buffer.from(buffer));
    } catch (err) {
        console.error(JSON.stringify({ event: "downloadTemplate_error", message: err.message }));
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

exports.previewCards = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(422).json({ success: false, message: "File is required" });
        }
        const result = await batchImportService.previewCards(req.file.buffer);
        return res.json({ success: true, data: result });
    } catch (err) {
        if (err.code === "ROW_LIMIT_EXCEEDED") {
            return res.status(422).json({ success: false, message: err.message });
        }
        console.error(JSON.stringify({ event: "previewCards_error", message: err.message }));
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

exports.commitCards = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(422).json({ success: false, message: "File is required" });
        }
        const result = await batchImportService.commitCards(req.file.buffer);
        if (!result.committed) {
            return res.status(422).json({ success: false, message: "Validation failed", errors: result.errors });
        }
        return res.json({ success: true, data: result });
    } catch (err) {
        if (err.code === "ROW_LIMIT_EXCEEDED") {
            return res.status(422).json({ success: false, message: err.message });
        }
        console.error(JSON.stringify({ event: "commitCards_error", message: err.message }));
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

exports.previewSubs = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(422).json({ success: false, message: "File is required" });
        }
        const result = await batchImportService.previewSubs(req.file.buffer);
        return res.json({ success: true, data: result });
    } catch (err) {
        if (err.code === "ROW_LIMIT_EXCEEDED") {
            return res.status(422).json({ success: false, message: err.message });
        }
        console.error(JSON.stringify({ event: "previewSubs_error", message: err.message }));
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

exports.commitSubs = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(422).json({ success: false, message: "File is required" });
        }
        const result = await batchImportService.commitSubs(req.file.buffer);
        if (!result.committed) {
            return res.status(422).json({ success: false, message: "Validation failed", errors: result.errors });
        }
        return res.json({ success: true, data: result });
    } catch (err) {
        if (err.code === "ROW_LIMIT_EXCEEDED") {
            return res.status(422).json({ success: false, message: err.message });
        }
        console.error(JSON.stringify({ event: "commitSubs_error", message: err.message }));
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

exports.exportSessions = async (req, res) => {
    try {
        const { from, to } = req.query;
        const rows = await batchExportRepo.getSessionsForExport({ from, to });
        const buffer = await batchExportService.buildWorkbookBuffer(rows, batchExportService.SESSION_COLUMNS);
        const filename = `sessions_${from || "all"}_${to || "all"}.xlsx`;
        res.set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.set("Content-Disposition", `attachment; filename="${filename}"`);
        return res.send(Buffer.from(buffer));
    } catch (err) {
        console.error(JSON.stringify({ event: "exportSessions_error", message: err.message }));
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

exports.exportPayments = async (req, res) => {
    try {
        const { from, to } = req.query;
        const rows = await batchExportRepo.getPaymentsForExport({ from, to });
        const buffer = await batchExportService.buildWorkbookBuffer(rows, batchExportService.PAYMENT_COLUMNS);
        const filename = `payments_${from || "all"}_${to || "all"}.xlsx`;
        res.set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.set("Content-Disposition", `attachment; filename="${filename}"`);
        return res.send(Buffer.from(buffer));
    } catch (err) {
        console.error(JSON.stringify({ event: "exportPayments_error", message: err.message }));
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

exports.exportCards = async (req, res) => {
    try {
        const rows = await batchExportRepo.getCardsForExport();
        const buffer = await batchExportService.buildWorkbookBuffer(rows, batchExportService.CARD_EXPORT_COLUMNS);
        const filename = "parking_cards.xlsx";
        res.set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.set("Content-Disposition", `attachment; filename="${filename}"`);
        return res.send(Buffer.from(buffer));
    } catch (err) {
        console.error(JSON.stringify({ event: "exportCards_error", message: err.message }));
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

exports.exportSubs = async (req, res) => {
    try {
        const rows = await batchExportRepo.getSubsForExport();
        // Add empty action column for round-trip editing
        const exportRows = rows.map(r => ({ ...r, action: "" }));
        const buffer = await batchExportService.buildWorkbookBuffer(exportRows, batchExportService.SUB_EXPORT_COLUMNS);
        const filename = "monthly_subscriptions.xlsx";
        res.set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.set("Content-Disposition", `attachment; filename="${filename}"`);
        return res.send(Buffer.from(buffer));
    } catch (err) {
        console.error(JSON.stringify({ event: "exportSubs_error", message: err.message }));
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};
