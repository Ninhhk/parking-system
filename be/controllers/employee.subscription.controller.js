const parkingCardsRepo = require("../repositories/parkingCards.repo");
const { deriveEffectiveMonthly } = require("../services/issuedCardEntry");

/**
 * GET /api/employee/subscription/by-card/:card_uid
 * Returns whether the card has an active monthly subscription (card-pool-derived).
 * The kiosk uses this to decide "subscriber" vs "casual_card" path.
 *
 * Response shape: { monthly: true } when effective monthly.
 * 404 when card is not monthly (or card doesn't exist).
 */
exports.getByCard = async (req, res) => {
    try {
        const { card_uid } = req.params;

        if (!card_uid || !card_uid.trim()) {
            return res.status(422).json({
                success: false,
                message: "card_uid is required",
            });
        }

        const poolCard = await parkingCardsRepo.getPoolCard(card_uid.trim());

        if (!poolCard || !deriveEffectiveMonthly(poolCard)) {
            return res.status(404).json({
                success: false,
                message: "No active subscription found for this card",
            });
        }

        return res.status(200).json({
            success: true,
            data: {
                monthly: true,
                // vehicle_type no longer stored on cards — resolved by lane config or operator pick
                vehicle_type: null,
            },
        });
    } catch (error) {
        console.error("Subscription lookup error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};
