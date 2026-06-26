/**
 * Card UID validation shared by the Card Pool API and check-in flow.
 *
 * Mirrors the frontend ReaderPanel helper so client- and server-side
 * validation agree: a UID is 1-100 chars of alphanumerics and hyphens.
 */

const CARD_UID_REGEX = /^[A-Za-z0-9-]{1,100}$/;

/**
 * Returns true when the value is a well-formed card UID:
 * a string of 1-100 characters limited to letters, digits, and hyphens.
 */
function isValidCardUid(value) {
    if (typeof value !== "string") return false;
    return CARD_UID_REGEX.test(value);
}

module.exports = { isValidCardUid, CARD_UID_REGEX };
