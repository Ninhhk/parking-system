const parkingCardsService = require("../services/admin.parkingCards.service");
const parkingCardsRepo = require("../repositories/parkingCards.repo");
const cardHoldersRepo = require("../repositories/cardHolders.repo");
const { isValidCardUid } = require("../utils/cardUid");

function handleServiceError(res, err) {
    const status = err.statusCode || 500;
    const message = err.statusCode ? err.message : "Internal server error";
    return res.status(status).json({ success: false, message });
}

exports.listCards = async (req, res) => {
    try {
        const { q } = req.query;
        const cards = await parkingCardsService.listCards(typeof q === "string" ? q : undefined);
        return res.status(200).json({ success: true, data: cards });
    } catch (err) {
        return handleServiceError(res, err);
    }
};

exports.getInventory = async (req, res) => {
    try {
        const inventory = await parkingCardsService.getInventory();
        return res.status(200).json({ success: true, data: inventory });
    } catch (err) {
        return handleServiceError(res, err);
    }
};

exports.createCard = async (req, res) => {
    const { card_uid } = req.body;

    if (!isValidCardUid(card_uid)) {
        return res.status(422).json({ success: false, message: "Invalid card UID" });
    }

    // lot_id: positive integer, or null/absent for a shared card
    let lot_id = req.body.lot_id;
    if (lot_id === undefined || lot_id === null || lot_id === "") {
        lot_id = null;
    } else {
        const parsed = Number(lot_id);
        if (!Number.isInteger(parsed) || parsed <= 0) {
            return res.status(422).json({ success: false, message: "lot_id must be a positive integer or null" });
        }
        lot_id = parsed;
    }

    try {
        const card = await parkingCardsService.createCard({ card_uid, lot_id });
        return res.status(201).json({ success: true, data: card });
    } catch (err) {
        return handleServiceError(res, err);
    }
};

exports.setStatus = async (req, res) => {
    const { card_uid } = req.params;
    const { status } = req.body;

    if (!isValidCardUid(card_uid)) {
        return res.status(422).json({ success: false, message: "Invalid card UID" });
    }
    if (!["available", "lost"].includes(status)) {
        return res.status(422).json({ success: false, message: "status must be 'available' or 'lost'" });
    }

    try {
        const card = await parkingCardsService.setStatus(card_uid, status);
        return res.status(200).json({ success: true, data: card });
    } catch (err) {
        return handleServiceError(res, err);
    }
};

exports.deleteCard = async (req, res) => {
    const { card_uid } = req.params;

    if (!isValidCardUid(card_uid)) {
        return res.status(422).json({ success: false, message: "Invalid card UID" });
    }

    try {
        const deleted = await parkingCardsService.deleteCard(card_uid);
        return res.status(200).json({ success: true, data: deleted });
    } catch (err) {
        return handleServiceError(res, err);
    }
};

exports.updateMonthly = async (req, res) => {
    const { card_uid } = req.params;
    const { is_monthly, monthly_end_date } = req.body;

    if (!isValidCardUid(card_uid)) {
        return res.status(422).json({ success: false, message: "Invalid card UID" });
    }
    if (typeof is_monthly !== "boolean") {
        return res.status(422).json({ success: false, message: "is_monthly must be a boolean" });
    }
    if (is_monthly && !monthly_end_date) {
        return res.status(422).json({ success: false, message: "monthly_end_date is required when enabling monthly" });
    }
    // Validate date format if provided
    if (monthly_end_date) {
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(monthly_end_date) || Number.isNaN(new Date(monthly_end_date).getTime())) {
            return res.status(422).json({ success: false, message: "monthly_end_date must be a valid YYYY-MM-DD date" });
        }
    }

    try {
        const card = await parkingCardsService.updateMonthly(card_uid, {
            is_monthly,
            monthly_end_date: is_monthly ? monthly_end_date : null,
        });
        return res.status(200).json({ success: true, data: card });
    } catch (err) {
        return handleServiceError(res, err);
    }
};

exports.getHolder = async (req, res) => {
    const { card_uid } = req.params;

    if (!isValidCardUid(card_uid)) {
        return res.status(422).json({ success: false, message: "Invalid card UID" });
    }

    try {
        const holder = await cardHoldersRepo.getHolder(card_uid);
        if (!holder) {
            return res.status(404).json({ success: false, message: "No holder found for this card" });
        }
        return res.status(200).json({ success: true, data: holder });
    } catch (err) {
        return handleServiceError(res, err);
    }
};

exports.upsertHolder = async (req, res) => {
    const { card_uid } = req.params;
    const { holder_name, holder_phone, license_plate, vehicle_type } = req.body;

    if (!isValidCardUid(card_uid)) {
        return res.status(422).json({ success: false, message: "Invalid card UID" });
    }
    if (!holder_name || !holder_name.trim()) {
        return res.status(422).json({ success: false, message: "holder_name is required" });
    }
    if (!holder_phone || !holder_phone.trim()) {
        return res.status(422).json({ success: false, message: "holder_phone is required" });
    }

    try {
        const card = await parkingCardsRepo.getPoolCard(card_uid);
        if (!card) {
            return res.status(404).json({ success: false, message: "Card not found" });
        }
        if (!card.is_monthly) {
            return res.status(422).json({ success: false, message: "Holder info can only be assigned to monthly cards" });
        }

        const holder = await cardHoldersRepo.upsertHolder(card_uid, {
            holder_name: holder_name.trim(),
            holder_phone: holder_phone.trim(),
            license_plate: license_plate || null,
            vehicle_type: vehicle_type || null,
        });
        return res.status(200).json({ success: true, data: holder });
    } catch (err) {
        return handleServiceError(res, err);
    }
};

exports.deleteHolder = async (req, res) => {
    const { card_uid } = req.params;

    if (!isValidCardUid(card_uid)) {
        return res.status(422).json({ success: false, message: "Invalid card UID" });
    }

    try {
        const deleted = await cardHoldersRepo.deleteHolder(card_uid);
        if (!deleted) {
            return res.status(404).json({ success: false, message: "No holder found for this card" });
        }
        return res.status(200).json({ success: true, data: deleted });
    } catch (err) {
        return handleServiceError(res, err);
    }
};
