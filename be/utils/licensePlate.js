function sanitizePlate(input) {
    if (!input || typeof input !== "string") return "";
    let plate = input.trim().toUpperCase();
    // Replace common OCR confusions
    plate = plate
        .replace(/O/g, "0")
        .replace(/I/g, "1")
        .replace(/Z/g, "2")
        .replace(/S/g, "5")
        .replace(/B/g, "8");
    // Remove spaces and non allowed chars except hyphen
    plate = plate.replace(/[^A-Z0-9-]/g, "");
    // Collapse multiple hyphens
    plate = plate.replace(/-+/g, "-");
    // Trim leading/trailing hyphen
    plate = plate.replace(/^-/, "").replace(/-$/, "");
    return plate;
}

module.exports = { sanitizePlate };
