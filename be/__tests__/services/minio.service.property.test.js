const fc = require("fast-check");
const { deriveObjectKey } = require("../../services/minio.service");
const Minio = require("minio");

/**
 * Feature: minio-image-storage
 * Property 2: Invalid buffer size is always rejected
 * Validates: Requirements 2.6
 */
describe("Feature: minio-image-storage, Property 2: Invalid buffer size is always rejected", () => {
    let uploadImage;
    let mockPutObject;

    beforeEach(() => {
        jest.resetModules();
        mockPutObject = jest.fn().mockResolvedValue();
        jest.mock("../../config/minio", () => ({
            minioClient: { putObject: mockPutObject },
            MINIO_BUCKET: "parking-images",
            isMinioConfigured: true,
            MINIO_EXTERNAL_ENDPOINT: "localhost",
            MINIO_EXTERNAL_PORT: 9000,
        }));
        ({ uploadImage } = require("../../services/minio.service"));
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("rejects empty buffer (size 0) without calling putObject", async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.constantFrom("in", "out"),
                fc.constantFrom("jpg", "jpeg", "png"),
                fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
                fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
                async (direction, ext, lotId, sessionId) => {
                    const emptyBuffer = Buffer.alloc(0);
                    await expect(
                        uploadImage(emptyBuffer, { lotId, sessionId, direction, ext })
                    ).rejects.toThrow();
                    expect(mockPutObject).not.toHaveBeenCalled();
                }
            ),
            { numRuns: 100 }
        );
    });

    it("rejects buffer exceeding 10 MB without calling putObject", async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.nat({ max: 1024 }),
                fc.constantFrom("in", "out"),
                fc.constantFrom("jpg", "jpeg", "png"),
                fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
                fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
                async (extra, direction, ext, lotId, sessionId) => {
                    const oversizedBuffer = Buffer.alloc(10485761 + extra);
                    await expect(
                        uploadImage(oversizedBuffer, { lotId, sessionId, direction, ext })
                    ).rejects.toThrow();
                    expect(mockPutObject).not.toHaveBeenCalled();
                }
            ),
            { numRuns: 100 }
        );
    });
});

/**
 * Feature: minio-image-storage
 * Property 3: Missing required parameters are identified in error
 * Validates: Requirements 2.7
 */
describe("Feature: minio-image-storage, Property 3: Missing required parameters are identified in error", () => {
    const missingValue = fc.oneof(
        fc.constant(null),
        fc.constant(undefined),
        fc.constant("")
    );

    const validLotId = fc.string({ minLength: 1 }).filter(s => s.trim().length > 0);
    const validSessionId = fc.string({ minLength: 1 }).filter(s => s.trim().length > 0);
    const validDirection = fc.oneof(fc.constant("in"), fc.constant("out"));
    const validExt = fc.oneof(fc.constant("jpg"), fc.constant("jpeg"), fc.constant("png"));

    it("error message contains 'lotId' when lotId is null/undefined/empty", () => {
        fc.assert(
            fc.property(
                missingValue,
                validSessionId,
                validDirection,
                validExt,
                (lotId, sessionId, direction, ext) => {
                    try {
                        deriveObjectKey({ lotId, sessionId, direction, ext });
                        return false; // should have thrown
                    } catch (err) {
                        return err.message.includes("lotId");
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    it("error message contains 'sessionId' when sessionId is null/undefined/empty", () => {
        fc.assert(
            fc.property(
                validLotId,
                missingValue,
                validDirection,
                validExt,
                (lotId, sessionId, direction, ext) => {
                    try {
                        deriveObjectKey({ lotId, sessionId, direction, ext });
                        return false; // should have thrown
                    } catch (err) {
                        return err.message.includes("sessionId");
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    it("error message contains 'direction' when direction is invalid", () => {
        const invalidDirection = fc.string().filter(s => s !== "in" && s !== "out");

        fc.assert(
            fc.property(
                validLotId,
                validSessionId,
                invalidDirection,
                validExt,
                (lotId, sessionId, direction, ext) => {
                    try {
                        deriveObjectKey({ lotId, sessionId, direction, ext });
                        return false; // should have thrown
                    } catch (err) {
                        return err.message.includes("direction");
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    it("error message contains 'ext' when ext is invalid", () => {
        const invalidExt = fc.string().filter(s => s !== "jpg" && s !== "jpeg" && s !== "png");

        fc.assert(
            fc.property(
                validLotId,
                validSessionId,
                validDirection,
                invalidExt,
                (lotId, sessionId, direction, ext) => {
                    try {
                        deriveObjectKey({ lotId, sessionId, direction, ext });
                        return false; // should have thrown
                    } catch (err) {
                        return err.message.includes("ext");
                    }
                }
            ),
            { numRuns: 100 }
        );
    });
});


/**
 * Feature: minio-image-storage
 * Property 4: Presigned URL expiry is always 3600 seconds
 * Validates: Requirements 3.1
 */
describe("Feature: minio-image-storage, Property 4: Presigned URL expiry is always 3600 seconds", () => {
    let getPresignedUrl;
    let mockPresignedGetObject;

    beforeEach(() => {
        jest.resetModules();
        mockPresignedGetObject = jest.fn().mockResolvedValue("http://localhost:9000/parking-images/test?signed");
        jest.mock("minio", () => ({
            Client: jest.fn().mockImplementation(() => ({
                presignedGetObject: mockPresignedGetObject,
                putObject: jest.fn().mockResolvedValue(),
            })),
        }));
        jest.mock("../../config/minio", () => ({
            minioClient: { putObject: jest.fn().mockResolvedValue() },
            MINIO_BUCKET: "parking-images",
            isMinioConfigured: true,
            MINIO_EXTERNAL_ENDPOINT: "localhost",
            MINIO_EXTERNAL_PORT: 9000,
        }));
        ({ getPresignedUrl } = require("../../services/minio.service"));
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("calls presignedGetObject with expiry 3600 for any valid object key", async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
                async (objectKey) => {
                    mockPresignedGetObject.mockClear();
                    await getPresignedUrl(objectKey);
                    expect(mockPresignedGetObject).toHaveBeenCalledWith(
                        "parking-images",
                        objectKey,
                        3600
                    );
                }
            ),
            { numRuns: 100 }
        );
    });
});
