const subscriptionRepo = require("../repositories/employee.subscription.repo");

/**
 * Look up an active monthly subscription by card UID.
 * Returns the subscription data or null if not found.
 */
async function getActiveSubscriptionByCard(cardUid) {
    return subscriptionRepo.findActiveByCardUid(cardUid);
}

module.exports = { getActiveSubscriptionByCard };
