// Feature: minio-image-storage
// Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 3.1, 3.2, 3.3, 3.4

const {
    minioClient,
    MINIO_BUCKET,
    isMinioConfigured,
    MINIO_EXTERNAL_ENDPOINT,
    MINIO_EXTERNAL_PORT,
} = require("../config/minio");

// Client configured with browser-reachable endpoint for presigned URL generation.
// Uses region 'us-east-1' explicitly to avoid the SDK making a network call to discover it.
const Minio = require("minio");
let presignClient = null;
if (isMinioConfigured) {
    presignClient = new Minio.Client({
        endPoint: MINIO_EXTERNAL_ENDPOINT,
        port: MINIO_EXTERNAL_PORT,
        useSSL: process.env.MINIO_USE_SSL === "true",
        accessKey: process.env.MINIO_ACCESS_KEY,
        secretKey: process.env.MINIO_SECRET_KEY,
        region: "us-east-1",
    });
}

const VALID_DIRECTIONS = ["in", "out", "id"];
const VALID_EXTENSIONS = ["jpg", "jpeg", "png"];
const MAX_BUFFER_SIZE = 10 * 1024 * 1024; // 10 MB

/**
 * Derives the MinIO object key for a parking session image.
 *
 * @param {Object} params
 * @param {string} params.lotId - Parking lot identifier
 * @param {string} params.sessionId - Session identifier
 * @param {string} params.direction - "in" or "out"
 * @param {string} params.ext - File extension: "jpg", "jpeg", or "png"
 * @returns {string} Object key in format: {lotId}/{YYYY-MM-DD}/{sessionId}_{direction}.{ext}
 */
function deriveObjectKey({ lotId, sessionId, direction, ext }) {
    if (!lotId || typeof lotId !== "string") {
        throw new Error("Validation error: lotId is required and must be a non-empty string");
    }
    if (!sessionId || typeof sessionId !== "string") {
        throw new Error("Validation error: sessionId is required and must be a non-empty string");
    }
    if (!direction || !VALID_DIRECTIONS.includes(direction)) {
        throw new Error("Validation error: direction must be \"in\" or \"out\"");
    }
    if (!ext || typeof ext !== "string" || !VALID_EXTENSIONS.includes(ext)) {
        throw new Error("Validation error: ext must be \"jpg\", \"jpeg\", or \"png\"");
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const dateStr = `${year}-${month}-${day}`;

    return `${lotId}/${dateStr}/${sessionId}_${direction}.${ext}`;
}

/**
 * Uploads an image buffer to MinIO.
 *
 * @param {Buffer} buffer - Image data
 * @param {Object} params
 * @param {string} params.lotId - Parking lot identifier
 * @param {string} params.sessionId - Session identifier
 * @param {string} params.direction - "in" or "out"
 * @param {string} params.ext - File extension: "jpg", "jpeg", or "png"
 * @returns {Promise<string>} Object key of the uploaded image
 */
async function uploadImage(buffer, { lotId, sessionId, direction, ext }) {
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
        throw new Error("Validation error: buffer must be a non-empty Buffer");
    }
    if (buffer.length > MAX_BUFFER_SIZE) {
        throw new Error("Validation error: buffer exceeds 10 MB size limit");
    }

    const objectKey = deriveObjectKey({ lotId, sessionId, direction, ext });

    const mime = (ext === "png") ? "image/png" : "image/jpeg";

    try {
        await minioClient.putObject(MINIO_BUCKET, objectKey, buffer, buffer.length, { "Content-Type": mime });
    } catch (err) {
        throw new Error(`Failed to upload image: ${err.message}`);
    }

    return objectKey;
}

/**
 * Generates a presigned GET URL for an object in MinIO.
 * Uses the presignClient configured with the browser-reachable endpoint
 * and explicit region to avoid network calls during URL generation.
 *
 * @param {string} objectKey - The object key in the bucket
 * @returns {Promise<string|null>} Presigned URL or null on any failure
 */
async function getPresignedUrl(objectKey) {
    if (!isMinioConfigured || !presignClient || !objectKey) {
        return null;
    }
    try {
        const url = await presignClient.presignedGetObject(MINIO_BUCKET, objectKey, 3600);
        return url;
    } catch (err) {
        return null;
    }
}

module.exports = { deriveObjectKey, uploadImage, getPresignedUrl };
