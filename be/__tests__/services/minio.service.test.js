jest.mock("../../config/minio", () => ({
    minioClient: { putObject: jest.fn() },
    isMinioConfigured: true,
    MINIO_BUCKET: "parking-images",
    MINIO_EXTERNAL_ENDPOINT: "localhost",
    MINIO_EXTERNAL_PORT: 9000,
}));

const mockPresignedGetObject = jest.fn();
jest.mock("minio", () => ({
    Client: jest.fn().mockImplementation(() => ({
        presignedGetObject: mockPresignedGetObject,
    })),
}));

const { uploadImage, getPresignedUrl } = require("../../services/minio.service");
const { minioClient } = require("../../config/minio");

describe("minio.service", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("uploadImage", () => {
        const validParams = {
            lotId: "lot-1",
            sessionId: "sess-123",
            direction: "in",
            ext: "jpg",
        };

        it("returns object key matching expected pattern on success", async () => {
            minioClient.putObject.mockResolvedValue();

            const key = await uploadImage(Buffer.alloc(1024), validParams);

            expect(key).toMatch(
                /^lot-1\/\d{4}-\d{2}-\d{2}\/sess-123_in\.jpg$/
            );
            expect(minioClient.putObject).toHaveBeenCalledWith(
                "parking-images",
                key,
                expect.any(Buffer),
                1024,
                { "Content-Type": "image/jpeg" }
            );
        });

        it("throws when buffer is empty", async () => {
            await expect(
                uploadImage(Buffer.alloc(0), validParams)
            ).rejects.toThrow("buffer");
        });

        it("throws when buffer exceeds 10 MB", async () => {
            await expect(
                uploadImage(Buffer.alloc(10485761), validParams)
            ).rejects.toThrow("10 MB");
        });
    });

    describe("getPresignedUrl", () => {
        it("returns null when isMinioConfigured is false", async () => {
            jest.resetModules();
            jest.mock("../../config/minio", () => ({
                minioClient: { putObject: jest.fn() },
                isMinioConfigured: false,
                MINIO_BUCKET: "parking-images",
                MINIO_EXTERNAL_ENDPOINT: "localhost",
                MINIO_EXTERNAL_PORT: 9000,
            }));
            jest.mock("minio", () => ({
                Client: jest.fn().mockImplementation(() => ({
                    presignedGetObject: jest.fn(),
                })),
            }));
            const { getPresignedUrl: getUrl } = require("../../services/minio.service");

            const result = await getUrl("lot-1/2024-01-01/sess-123_in.jpg");
            expect(result).toBeNull();
        });

        it("returns null when presignedGetObject throws", async () => {
            mockPresignedGetObject.mockRejectedValue(new Error("connection refused"));

            const result = await getPresignedUrl("lot-1/2024-01-01/sess-123_in.jpg");
            expect(result).toBeNull();
        });

        it("returns URL string on success", async () => {
            const fakeUrl = "http://localhost:9000/parking-images/lot-1/2024-01-01/sess-123_in.jpg?X-Amz-Signature=abc";
            mockPresignedGetObject.mockResolvedValue(fakeUrl);

            const result = await getPresignedUrl("lot-1/2024-01-01/sess-123_in.jpg");
            expect(result).toBe(fakeUrl);
        });
    });
});
