const parkingCardsRepo = require("../repositories/parkingCards.repo");

function createError(statusCode, message) {
    const err = new Error(message);
    err.statusCode = statusCode;
    return err;
}

exports.listCards = async (q) => {
    return parkingCardsRepo.listPoolCards(q);
};

exports.getInventory = async () => {
    return parkingCardsRepo.getInventoryCounts();
};

exports.createCard = async ({ card_uid, lot_id }) => {
    try {
        return await parkingCardsRepo.insertPoolCard(card_uid, lot_id ?? null);
    } catch (err) {
        if (err.code === "23505") {
            throw createError(422, "Card already exists"); // Req 2.4
        }
        if (err.code === "23503") {
            throw createError(422, "Assigned lot does not exist"); // FK violation
        }
        throw err;
    }
};

exports.setStatus = async (card_uid, status) => {
    const updated = await parkingCardsRepo.setStatus(card_uid, status);
    if (!updated) {
        throw createError(404, "Card not found"); // Req 4.4
    }
    return updated;
};

exports.deleteCard = async (card_uid) => {
    const active = await parkingCardsRepo.hasActiveSession(card_uid);
    if (active) {
        throw createError(409, "Card is in use and cannot be deleted"); // Req 3.3
    }
    const deleted = await parkingCardsRepo.deletePoolCard(card_uid);
    if (!deleted) {
        throw createError(404, "Card not found"); // Req 3.2
    }
    return deleted;
};
