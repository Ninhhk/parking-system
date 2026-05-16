const Minio = require("minio");
require("dotenv").config();

const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT || "minio";
const MINIO_PORT = parseInt(process.env.MINIO_PORT || "9000", 10);
const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY;
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY;
const MINIO_USE_SSL = process.env.MINIO_USE_SSL === "true";
const MINIO_EXTERNAL_ENDPOINT = process.env.MINIO_EXTERNAL_ENDPOINT || "localhost";
const MINIO_EXTERNAL_PORT = parseInt(process.env.MINIO_EXTERNAL_PORT || "9000", 10);

const MINIO_BUCKET = "parking-images";

let minioClient = null;
let isMinioConfigured = false;

if (!MINIO_ACCESS_KEY || !MINIO_SECRET_KEY) {
    const missing = [];
    if (!MINIO_ACCESS_KEY) missing.push("MINIO_ACCESS_KEY");
    if (!MINIO_SECRET_KEY) missing.push("MINIO_SECRET_KEY");
    console.warn(`[MinIO] Warning: Missing environment variable(s): ${missing.join(", ")}. MinIO functionality disabled.`);
} else {
    minioClient = new Minio.Client({
        endPoint: MINIO_ENDPOINT,
        port: MINIO_PORT,
        useSSL: MINIO_USE_SSL,
        accessKey: MINIO_ACCESS_KEY,
        secretKey: MINIO_SECRET_KEY,
    });
    isMinioConfigured = true;
}

module.exports = {
    minioClient,
    MINIO_BUCKET,
    isMinioConfigured,
    MINIO_EXTERNAL_ENDPOINT,
    MINIO_EXTERNAL_PORT,
};
