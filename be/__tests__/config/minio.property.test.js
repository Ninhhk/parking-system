const fc = require("fast-check");

/**
 * Feature: minio-image-storage, Property 5: Configuration parsing produces correct client options
 * Validates: Requirements 7.1
 *
 * For any valid env var combination, verify client instantiation args match parsed values.
 */

describe("Feature: minio-image-storage, Property 5: Configuration parsing produces correct client options", () => {
    let capturedArgs;

    beforeEach(() => {
        capturedArgs = null;
        jest.resetModules();

        jest.mock("minio", () => ({
            Client: jest.fn(function (opts) {
                capturedArgs = opts;
            }),
        }));
    });

    afterEach(() => {
        jest.restoreAllMocks();
        delete process.env.MINIO_ENDPOINT;
        delete process.env.MINIO_PORT;
        delete process.env.MINIO_ACCESS_KEY;
        delete process.env.MINIO_SECRET_KEY;
        delete process.env.MINIO_USE_SSL;
    });

    it("instantiates MinIO Client with options matching parsed env vars", () => {
        fc.assert(
            fc.property(
                fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
                fc.integer({ min: 1, max: 65535 }),
                fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
                fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
                fc.constantFrom("true", "false"),
                (endpoint, port, accessKey, secretKey, useSsl) => {
                    jest.resetModules();
                    capturedArgs = null;

                    jest.mock("minio", () => ({
                        Client: jest.fn(function (opts) {
                            capturedArgs = opts;
                        }),
                    }));

                    process.env.MINIO_ENDPOINT = endpoint;
                    process.env.MINIO_PORT = String(port);
                    process.env.MINIO_ACCESS_KEY = accessKey;
                    process.env.MINIO_SECRET_KEY = secretKey;
                    process.env.MINIO_USE_SSL = useSsl;

                    require("../../config/minio");

                    expect(capturedArgs).not.toBeNull();
                    expect(capturedArgs.endPoint).toBe(endpoint);
                    expect(capturedArgs.port).toBe(port);
                    expect(capturedArgs.accessKey).toBe(accessKey);
                    expect(capturedArgs.secretKey).toBe(secretKey);
                    expect(capturedArgs.useSSL).toBe(useSsl === "true");
                }
            ),
            { numRuns: 100 }
        );
    });
});
