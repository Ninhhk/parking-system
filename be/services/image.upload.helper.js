const { isMinioConfigured } = require("../config/minio");
const minioService = require("./minio.service");

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB
const UPLOAD_TIMEOUT_MS = 5000; // 5 seconds

/**
 * Determines if a string looks like base64 image data (not a URL/path).
 * Accepts raw base64 or data URI format (data:image/...;base64,...).
 */
function isBase64Image(value) {
    if (!value || typeof value !== "string") {
        return false;
    }
    // Data URI format
    if (value.startsWith("data:image/")) {
        return true;
    }
    // Not a URL or file path
    if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("/")) {
        return false;
    }
    // Heuristic: long string without path separators is likely base64
    return value.length > 100 && !value.includes("/");
}

/**
 * Extracts the raw base64 string and extension from a base64 image value.
 * Handles both data URI format and raw base64.
 */
function parseBase64Image(value) {
    if (value.startsWith("data:image/")) {
        const match = value.match(/^data:image\/(jpeg|jpg|png);base64,(.+)$/);
        if (match) {
            const ext = match[1] === "jpeg" ? "jpg" : match[1];
            return { raw: match[2], ext };
        }
    }
    // Default to jpg for raw base64 without data URI prefix
    return { raw: value, ext: "jpg" };
}

/**
 * Uploads a check-in image to MinIO with timeout and graceful failure.
 *
 * @param {string} base64Image - Base64-encoded image (raw or data URI)
 * @param {Object} params
 * @param {string} params.lotId - Parking lot ID
 * @param {string} params.sessionId - Session ID (as string)
 * @param {string} params.direction - "in" or "out"
 * @param {string} [params.ext] - Override extension (jpg, jpeg, png)
 * @returns {Promise<string|null>} Object key on success, null on failure
 */
async function uploadCheckinImage(base64Image, { lotId, sessionId, direction, ext }) {
    if (!isMinioConfigured) {
        return null;
    }

    if (!base64Image || typeof base64Image !== "string") {
        return null;
    }

    try {
        const parsed = parseBase64Image(base64Image);
        const finalExt = ext || parsed.ext;
        const buffer = Buffer.from(parsed.raw, "base64");

        // Validate size
        if (buffer.length === 0) {
            console.error(`[ImageUpload] Empty image buffer for session ${sessionId}`);
            return null;
        }
        if (buffer.length > MAX_IMAGE_SIZE) {
            console.warn(`[ImageUpload] Image exceeds 10 MB for session ${sessionId} (${buffer.length} bytes)`);
            return null;
        }

        // Upload with 5s timeout
        const uploadPromise = minioService.uploadImage(buffer, {
            lotId: String(lotId),
            sessionId: String(sessionId),
            direction,
            ext: finalExt,
        });

        let timer;
        const timeoutPromise = new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error("Upload timeout")), UPLOAD_TIMEOUT_MS);
        });

        try {
            const objectKey = await Promise.race([uploadPromise, timeoutPromise]);
            clearTimeout(timer);
            return objectKey;
        } catch (err) {
            clearTimeout(timer);
            throw err;
        }
    } catch (err) {
        console.error(`[ImageUpload] Failed for session ${sessionId}: ${err.message}`);
        return null;
    }
}

const CHECKOUT_UPLOAD_TIMEOUT_MS = 30000; // 30 seconds

/**
 * Uploads a check-out image to MinIO with 30s timeout and graceful failure.
 *
 * @param {string} base64Image - Base64-encoded image (raw or data URI)
 * @param {Object} params
 * @param {string} params.lotId - Parking lot ID
 * @param {string} params.sessionId - Session ID (as string)
 * @returns {Promise<string|null>} Object key on success, null on failure
 */
async function uploadCheckoutImage(base64Image, { lotId, sessionId }) {
    if (!isMinioConfigured) {
        return null;
    }

    if (!base64Image || typeof base64Image !== "string") {
        return null;
    }

    try {
        const parsed = parseBase64Image(base64Image);
        const buffer = Buffer.from(parsed.raw, "base64");

        if (buffer.length === 0) {
            console.error(JSON.stringify({
                event: "checkout_image_skip",
                reason: "empty_buffer",
                session_id: sessionId,
            }));
            return null;
        }
        if (buffer.length > MAX_IMAGE_SIZE) {
            console.error(JSON.stringify({
                event: "checkout_image_skip",
                reason: "size_violation",
                session_id: sessionId,
                size: buffer.length,
            }));
            return null;
        }

        const uploadPromise = minioService.uploadImage(buffer, {
            lotId: String(lotId),
            sessionId: String(sessionId),
            direction: "out",
            ext: parsed.ext,
        });

        let timer;
        const timeoutPromise = new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error("Upload timeout (30s)")), CHECKOUT_UPLOAD_TIMEOUT_MS);
        });

        try {
            const objectKey = await Promise.race([uploadPromise, timeoutPromise]);
            clearTimeout(timer);
            return objectKey;
        } catch (err) {
            clearTimeout(timer);
            throw err;
        }
    } catch (err) {
        console.error(JSON.stringify({
            event: "checkout_image_upload_failed",
            session_id: sessionId,
            error: err.message,
        }));
        return null;
    }
}

/**
 * Uploads a lost-ticket guest ID image to MinIO with 5s timeout and graceful failure.
 *
 * @param {string} base64Image - Base64-encoded image (raw or data URI)
 * @param {Object} params
 * @param {string} params.sessionId - Session ID (as string)
 * @returns {Promise<string|null>} Object key on success, null on failure
 */
async function uploadLostTicketImage(base64Image, { sessionId }) {
    if (!isMinioConfigured) {
        return null;
    }

    if (!base64Image || typeof base64Image !== "string") {
        return null;
    }

    try {
        const parsed = parseBase64Image(base64Image);
        const buffer = Buffer.from(parsed.raw, "base64");

        if (buffer.length === 0) {
            return null;
        }
        if (buffer.length > MAX_IMAGE_SIZE) {
            console.warn(`[ImageUpload] Lost-ticket image exceeds 10 MB for session ${sessionId}`);
            return null;
        }

        const uploadPromise = minioService.uploadImage(buffer, {
            lotId: "lost-tickets",
            sessionId: String(sessionId),
            direction: "id",
            ext: parsed.ext,
        });

        let timer;
        const timeoutPromise = new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error("Upload timeout")), UPLOAD_TIMEOUT_MS);
        });

        try {
            const objectKey = await Promise.race([uploadPromise, timeoutPromise]);
            clearTimeout(timer);
            return objectKey;
        } catch (err) {
            clearTimeout(timer);
            throw err;
        }
    } catch (err) {
        console.error(`[ImageUpload] Lost-ticket image failed for session ${sessionId}: ${err.message}`);
        return null;
    }
}

module.exports = { uploadCheckinImage, uploadCheckoutImage, uploadLostTicketImage, isBase64Image, parseBase64Image };
