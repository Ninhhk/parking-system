const { getActiveSubscriptionByCard } = require("../services/employee.subscription.service");

/**
 * GET /api/employee/subscription/by-card/:card_uid
 * Returns the active monthly subscription for a given card UID.
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

        const subscription = await getActiveSubscriptionByCard(card_uid);

        if (!subscription) {
            return res.status(404).json({
                success: false,
                message: "No active subscription found for this card",
            });
        }

        return res.status(200).json({
            success: true,
            data: subscription,
        });
    } catch (error) {
        console.error("Subscription lookup error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};
