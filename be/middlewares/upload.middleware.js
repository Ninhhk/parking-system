const multer = require("multer");
const { MAX_FILE_SIZE_BYTES } = require("../config/constants");

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_FILE_SIZE_BYTES, files: 1 },
});

module.exports = upload;
