jest.mock("../../config/minio", () => ({
    isMinioConfigured: true,
}));

const mockUploadImage = jest.fn();
jest.mock("../../services/minio.service", () => ({
    uploadImage: mockUploadImage,
}));

const { uploadCheckinImage, uploadCheckoutImage, isBase64Image } = require("../../services/image.upload.helper");

describe("image.upload.helper", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.restoreAllMocks();
        jest.useRealTimers();
    });

    const validBase64 = Buffer.from("fake-image-data-for-testing").toString("base64");

    describe("uploadCheckinImage", () => {
        const params = { lotId: "lot-1", sessionId: "sess-1", direction: "in", ext: "jpg" };

        it("returns object key on successful upload", async () => {
            mockUploadImage.mockResolvedValue("lot-1/2024-01-01/sess-1_in.jpg");

            const result = await uploadCheckinImage(validBase64, params);

            expect(result).toBe("lot-1/2024-01-01/sess-1_in.jpg");
            expect(mockUploadImage).toHaveBeenCalledWith(
                expect.any(Buffer),
                expect.objectContaining({
                    lotId: "lot-1",
                    sessionId: "sess-1",
                    direction: "in",
                    ext: "jpg",
                })
            );
        });

        it("returns null and logs error when upload rejects", async () => {
            mockUploadImage.mockRejectedValue(new Error("network failure"));

            const result = await uploadCheckinImage(validBase64, params);

            expect(result).toBeNull();
            expect(console.error).toHaveBeenCalled();
        });

        it("returns null without calling uploadImage when base64Image is null", async () => {
            const result = await uploadCheckinImage(null, params);

            expect(result).toBeNull();
            expect(mockUploadImage).not.toHaveBeenCalled();
        });

        it("returns null without calling uploadImage when base64Image is empty string", async () => {
            const result = await uploadCheckinImage("", params);

            expect(result).toBeNull();
            expect(mockUploadImage).not.toHaveBeenCalled();
        });

        it("returns null when upload exceeds 5s timeout", async () => {
            jest.useFakeTimers();

            mockUploadImage.mockImplementation(() => new Promise(() => {}));

            const promise = uploadCheckinImage(validBase64, params);

            jest.advanceTimersByTime(5001);

            const result = await promise;

            expect(result).toBeNull();
            expect(console.error).toHaveBeenCalled();
        });

        it("returns null and logs warning when image exceeds 10 MB", async () => {
            const largeBuffer = Buffer.alloc(10 * 1024 * 1024 + 1);
            const largeBase64 = largeBuffer.toString("base64");

            const result = await uploadCheckinImage(largeBase64, params);

            expect(result).toBeNull();
            expect(console.warn).toHaveBeenCalled();
            expect(mockUploadImage).not.toHaveBeenCalled();
        });

        it("returns null without calling uploadImage when MinIO is not configured", async () => {
            jest.resetModules();
            jest.doMock("../../config/minio", () => ({
                isMinioConfigured: false,
            }));
            jest.doMock("../../services/minio.service", () => ({
                uploadImage: jest.fn(),
            }));
            const { uploadCheckinImage: fn } = require("../../services/image.upload.helper");

            const result = await fn(validBase64, params);

            expect(result).toBeNull();
        });
    });

    describe("uploadCheckoutImage", () => {
        const params = { lotId: "lot-1", sessionId: "sess-100" };

        it("returns object key on successful upload", async () => {
            const expectedKey = "lot-1/2024-06-15/sess-100_out.jpg";
            mockUploadImage.mockResolvedValue(expectedKey);

            const result = await uploadCheckoutImage(validBase64, params);

            expect(result).toBe(expectedKey);
            expect(mockUploadImage).toHaveBeenCalledWith(
                expect.any(Buffer),
                expect.objectContaining({
                    lotId: "lot-1",
                    sessionId: "sess-100",
                    direction: "out",
                })
            );
        });

        it("returns null and logs error when uploadImage rejects", async () => {
            const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
            mockUploadImage.mockRejectedValue(new Error("MinIO connection refused"));

            const result = await uploadCheckoutImage(validBase64, params);

            expect(result).toBeNull();
            expect(consoleSpy).toHaveBeenCalled();
            const loggedArg = consoleSpy.mock.calls[0][0];
            const parsed = JSON.parse(loggedArg);
            expect(parsed.event).toBe("checkout_image_upload_failed");
            expect(parsed.session_id).toBe("sess-100");
        });

        it("returns null when base64Image is null", async () => {
            const result = await uploadCheckoutImage(null, params);

            expect(result).toBeNull();
            expect(mockUploadImage).not.toHaveBeenCalled();
        });

        it("returns null when base64Image is empty string", async () => {
            const result = await uploadCheckoutImage("", params);

            expect(result).toBeNull();
            expect(mockUploadImage).not.toHaveBeenCalled();
        });

        it("returns null when upload exceeds 30s timeout", async () => {
            jest.useFakeTimers();
            const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

            mockUploadImage.mockImplementation(() => new Promise(() => {}));

            const resultPromise = uploadCheckoutImage(validBase64, params);

            jest.advanceTimersByTime(30001);

            const result = await resultPromise;

            expect(result).toBeNull();
            expect(consoleSpy).toHaveBeenCalled();
            const loggedArg = consoleSpy.mock.calls[0][0];
            const parsed = JSON.parse(loggedArg);
            expect(parsed.event).toBe("checkout_image_upload_failed");
            expect(parsed.error).toContain("timeout");
        });

        it("returns null and logs size_violation when image exceeds 10MB", async () => {
            const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
            const largeBuffer = Buffer.alloc(10 * 1024 * 1024 + 1);
            const largeBase64 = largeBuffer.toString("base64");

            const result = await uploadCheckoutImage(largeBase64, params);

            expect(result).toBeNull();
            expect(mockUploadImage).not.toHaveBeenCalled();
            expect(consoleSpy).toHaveBeenCalled();
            const loggedArg = consoleSpy.mock.calls[0][0];
            const parsed = JSON.parse(loggedArg);
            expect(parsed.reason).toBe("size_violation");
            expect(parsed.session_id).toBe("sess-100");
        });

        it("returns null when isMinioConfigured is false", async () => {
            jest.resetModules();
            jest.doMock("../../config/minio", () => ({
                isMinioConfigured: false,
            }));
            jest.doMock("../../services/minio.service", () => ({
                uploadImage: jest.fn(),
            }));
            const { uploadCheckoutImage: fn } = require("../../services/image.upload.helper");

            const result = await fn(validBase64, params);

            expect(result).toBeNull();
        });
    });

    describe("isBase64Image", () => {
        it("returns true for data URI format", () => {
            expect(isBase64Image("data:image/jpeg;base64,/9j/4AAQ...")).toBe(true);
        });

        it("returns true for long base64 string without slashes", () => {
            const longBase64 = "A".repeat(200);
            expect(isBase64Image(longBase64)).toBe(true);
        });

        it("returns false for http URLs", () => {
            expect(isBase64Image("http://example.com/image.jpg")).toBe(false);
            expect(isBase64Image("https://example.com/image.jpg")).toBe(false);
        });

        it("returns false for file paths starting with /", () => {
            expect(isBase64Image("/uploads/images/photo.jpg")).toBe(false);
        });

        it("returns false for null", () => {
            expect(isBase64Image(null)).toBe(false);
        });

        it("returns false for undefined", () => {
            expect(isBase64Image(undefined)).toBe(false);
        });

        it("returns false for empty string", () => {
            expect(isBase64Image("")).toBe(false);
        });
    });
});
