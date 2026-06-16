// Position-aware license plate normalization.
//
// Must stay in sync with the Python LPD normalizer:
//   Licence-Plate-Detection-Recognition-Recording/services/plate_normalizer.py
//
// Vietnamese civilian plates: <2 province digits><1-2 series letters [+ digit]><serial digits>
// (cars: 30A-12345 or 30AB-12345, motorbikes: 90-B2 45230 or 19-DE 12345). Series
// letters must never be coerced to a digit (the "90B2" -> "9082" or "30AB" -> "30A8"
// bug from a global B->8 replace). We only fix a character toward the class its
// position expects; if the cleaned string does not match the civilian shape we
// return it raw rather than risk corrupting it.

// Letter -> digit, applied only at digit positions (province + serial)
const CHAR_TO_INT = { O: "0", I: "1", Z: "2", S: "5", B: "8" };
// Digit -> letter, applied only at series-letter positions
const INT_TO_CHAR = { 0: "O", 1: "I", 2: "Z", 5: "S", 8: "B" };

const MIN_CORE_LEN = 7;
const MAX_CORE_LEN = 9;

// Series spans index 2 (always a letter) and, for 2-letter series (30AB, 19DE),
// index 3 when the core is long enough to leave a valid serial and OCR saw a letter.
function isSeriesLetterSlot(index, ch, length) {
    if (index === 2) return true;
    if (index === 3 && length >= 8 && /[A-Z]/.test(ch)) return true;
    return false;
}

function correctVnPlate(core) {
    if (core.length < MIN_CORE_LEN || core.length > MAX_CORE_LEN) return null;

    let out = "";
    for (let i = 0; i < core.length; i++) {
        const ch = core[i];
        if (isSeriesLetterSlot(i, ch, core.length)) {
            // Series-letter position: must end up a letter
            if (/[A-Z]/.test(ch)) {
                out += ch;
            } else if (Object.prototype.hasOwnProperty.call(INT_TO_CHAR, ch)) {
                out += INT_TO_CHAR[ch];
            } else {
                return null;
            }
        } else {
            // Province / serial position: must end up a digit
            if (/[0-9]/.test(ch)) {
                out += ch;
            } else if (Object.prototype.hasOwnProperty.call(CHAR_TO_INT, ch)) {
                out += CHAR_TO_INT[ch];
            } else {
                return null;
            }
        }
    }
    return out;
}

function sanitizePlate(input) {
    if (!input || typeof input !== "string") return "";
    let plate = input.trim().toUpperCase();
    // Remove spaces and non-allowed chars except hyphen
    plate = plate.replace(/[^A-Z0-9-]/g, "");
    // Collapse multiple hyphens
    plate = plate.replace(/-+/g, "-");
    // Trim leading/trailing hyphen
    plate = plate.replace(/^-/, "").replace(/-$/, "");

    // Position-aware OCR correction on the alphanumeric core
    const core = plate.replace(/-/g, "");
    const corrected = correctVnPlate(core);
    if (corrected === null) {
        // Shape not recognized -> return raw (no risky confusion swaps)
        return plate;
    }

    // Re-insert corrected characters, preserving original hyphen positions
    let result = "";
    let idx = 0;
    for (const ch of plate) {
        if (ch === "-") {
            result += "-";
        } else {
            result += corrected[idx];
            idx += 1;
        }
    }
    return result;
}

module.exports = { sanitizePlate };
