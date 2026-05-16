const { beforeEach, afterEach, describe, it, expect } = require("@jest/globals");

let mockClientInstance;
let MockClient;

jest.mock("minio", () => {
    mockClientInstance = {};
    MockClient = jest.fn(() => mockClientInstance);
    return { Client: MockClient };
});

describe("be/config/minio.js", () => {
    const originalEnv = process.env;
    let warnSpy;

    beforeEach(() => {
        jest.resetModules();
        // Re-setup mock after resetModules
        mockClientInstance = {};
        MockClient = jest.fn(() => mockClientInstance);
        jest.mock("minio", () => ({ Client: MockClient }));

        process.env = { ...originalEnv };
        delete process.env.MINIO_ENDPOINT;
        delete process.env.MINIO_PORT;
        delete process.env.MINIO_ACCESS_KEY;
        delete process.env.MINIO_SECRET_KEY;
        delete process.env.MINIO_USE_SSL;
        delete process.env.MINIO_EXTERNAL_ENDPOINT;
        delete process.env.MINIO_EXTERNAL_PORT;

        warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    });

    afterEach(() => {
        process.env = originalEnv;
        warnSpy.mockRestore();
    });

    describe("when MINIO_ACCESS_KEY and MINIO_SECRET_KEY are missing", () => {
        it("sets isMinioConfigured to false", () => {
            const config = require("../../config/minio");
            expect(config.isMinioConfigured).toBe(false);
        });

        it("sets minioClient to null", () => {
            const config = require("../../config/minio");
            expect(config.minioClient).toBeNull();
        });

        it("logs a warning mentioning both missing variables", () => {
            require("../../config/minio");
            expect(warnSpy).toHaveBeenCalledWith(
                expect.stringContaining("MINIO_ACCESS_KEY")
            );
            expect(warnSpy).toHaveBeenCalledWith(
                expect.stringContaining("MINIO_SECRET_KEY")
            );
        });
    });

    describe("when only MINIO_ACCESS_KEY is missing", () => {
        beforeEach(() => {
            process.env.MINIO_SECRET_KEY = "test-secret";
        });

        it("sets isMinioConfigured to false and minioClient to null", () => {
            const config = require("../../config/minio");
            expect(config.isMinioConfigured).toBe(false);
            expect(config.minioClient).toBeNull();
        });

        it("logs a warning mentioning MINIO_ACCESS_KEY", () => {
            require("../../config/minio");
            expect(warnSpy).toHaveBeenCalledWith(
                expect.stringContaining("MINIO_ACCESS_KEY")
            );
        });
    });

    describe("when all vars provided", () => {
        beforeEach(() => {
            process.env.MINIO_ENDPOINT = "my-minio-host";
            process.env.MINIO_PORT = "9002";
            process.env.MINIO_ACCESS_KEY = "myAccessKey";
            process.env.MINIO_SECRET_KEY = "mySecretKey";
            process.env.MINIO_USE_SSL = "true";
        });

        it("sets isMinioConfigured to true", () => {
            const config = require("../../config/minio");
            expect(config.isMinioConfigured).toBe(true);
        });

        it("creates a non-null minioClient", () => {
            const config = require("../../config/minio");
            expect(config.minioClient).not.toBeNull();
        });

        it("calls Minio.Client with correct options", () => {
            require("../../config/minio");
            expect(MockClient).toHaveBeenCalledWith({
                endPoint: "my-minio-host",
                port: 9002,
                useSSL: true,
                accessKey: "myAccessKey",
                secretKey: "mySecretKey",
            });
        });
    });

    describe("default values", () => {
        beforeEach(() => {
            process.env.MINIO_ACCESS_KEY = "key";
            process.env.MINIO_SECRET_KEY = "secret";
        });

        it("MINIO_ENDPOINT defaults to 'minio'", () => {
            require("../../config/minio");
            expect(MockClient).toHaveBeenCalledWith(
                expect.objectContaining({ endPoint: "minio" })
            );
        });

        it("MINIO_PORT defaults to 9000", () => {
            require("../../config/minio");
            expect(MockClient).toHaveBeenCalledWith(
                expect.objectContaining({ port: 9000 })
            );
        });

        it("MINIO_USE_SSL defaults to false", () => {
            require("../../config/minio");
            expect(MockClient).toHaveBeenCalledWith(
                expect.objectContaining({ useSSL: false })
            );
        });
    });
});
