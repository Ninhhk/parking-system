const parkingCardsService = require("../services/admin.parkingCards.service");
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
