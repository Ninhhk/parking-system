const axios = require('axios');
const lpdService = require('../services/employee.lpd.service');

jest.mock('axios');

describe('Employee LPD Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.LPD_SERVICE_URL = 'http://localhost:5000';
        process.env.LPD_TIMEOUT = '30000';
    });

    describe('detectPlateFromImage', () => {
        it('should successfully detect plate from valid base64 image', async () => {
            const mockBase64 = Buffer.from('test image data').toString('base64');
            const mockResponse = {
                status: 200,
                data: {
                    success: true,
                    normalized_plate: '51G-39466',
                    raw_text: '51G-394.66',
                    confidence: 0.95,
                },
            };

            axios.post.mockResolvedValue(mockResponse);

            const result = await lpdService.detectPlateFromImage(mockBase64);

            expect(result).toEqual({
                success: true,
                normalized_plate: '51G-39466',
                raw_text: '51G-394.66',
                confidence: 0.95,
            });

            expect(axios.post).toHaveBeenCalledWith(
                'http://localhost:5000/api/detect',
                { image: mockBase64 },
                expect.objectContaining({
                    timeout: 30000,
                    headers: { 'Content-Type': 'application/json' },
                })
            );
        });

        it('should use default confidence when not provided', async () => {
            const mockBase64 = Buffer.from('test image data').toString('base64');
            const mockResponse = {
                status: 200,
                data: {
                    success: true,
                    normalized_plate: '51G-39466',
                    raw_text: '51G-394.66',
                    // confidence not provided
                },
            };

            axios.post.mockResolvedValue(mockResponse);

            const result = await lpdService.detectPlateFromImage(mockBase64);

            expect(result.confidence).toBe(0.9);
        });

        it('should throw error when base64 format is invalid', async () => {
            const invalidBase64 = 'not!!!valid%%%base64';

            await expect(lpdService.detectPlateFromImage(invalidBase64))
                .rejects
                .toThrow('Invalid base64 format');

            expect(axios.post).not.toHaveBeenCalled();
        });

        it('should throw error when image data is empty', async () => {
            const emptyBase64 = '';

            await expect(lpdService.detectPlateFromImage(emptyBase64))
                .rejects
                .toThrow('Image data is empty');
        });

        it('should throw error when no plate is detected', async () => {
            const mockBase64 = Buffer.from('image with no plate').toString('base64');
            const mockResponse = {
                status: 200,
                data: {
                    success: false,
                    error: 'No license plate detected in image',
                },
            };

            axios.post.mockResolvedValue(mockResponse);

            await expect(lpdService.detectPlateFromImage(mockBase64))
                .rejects
                .toThrow('No license plate detected in image');
        });

        it('should throw error when service is unavailable', async () => {
            const mockBase64 = Buffer.from('test image data').toString('base64');

            axios.post.mockRejectedValue({
                code: 'ECONNREFUSED',
                message: 'Connection refused',
            });

            await expect(lpdService.detectPlateFromImage(mockBase64))
                .rejects
                .toThrow('LPD service unavailable');
        });

        it('should throw error when service host is not found', async () => {
            const mockBase64 = Buffer.from('test image data').toString('base64');

            axios.post.mockRejectedValue({
                code: 'ENOTFOUND',
                message: 'getaddrinfo ENOTFOUND',
            });

            await expect(lpdService.detectPlateFromImage(mockBase64))
                .rejects
                .toThrow('Cannot reach LPD service');
        });

        it('should throw error on timeout', async () => {
            const mockBase64 = Buffer.from('test image data').toString('base64');

            axios.post.mockRejectedValue(
                new Error('Request timeout after 30000ms')
            );

            await expect(lpdService.detectPlateFromImage(mockBase64))
                .rejects
                .toThrow('LPD service request timed out');
        });

        it('should handle response without normalized_plate', async () => {
            const mockBase64 = Buffer.from('test image data').toString('base64');
            const mockResponse = {
                status: 200,
                data: {
                    success: true,
                    // missing normalized_plate
                    confidence: 0.5,
                },
            };

            axios.post.mockResolvedValue(mockResponse);

            await expect(lpdService.detectPlateFromImage(mockBase64))
                .rejects
                .toThrow('No license plate detected in image');
        });

        it('should reject non-string image input', async () => {
            await expect(lpdService.detectPlateFromImage(12345))
                .rejects
                .toThrow('Invalid base64 format');
        });
    });

    describe('healthCheck', () => {
        it('should return true when service is healthy', async () => {
            axios.get.mockResolvedValue({ status: 200 });

            const result = await lpdService.healthCheck();

            expect(result).toBe(true);
            expect(axios.get).toHaveBeenCalledWith(
                'http://localhost:5000/health',
                expect.objectContaining({ timeout: 5000 })
            );
        });

        it('should return false when service is unavailable', async () => {
            axios.get.mockRejectedValue(
                new Error('Connection refused')
            );

            const result = await lpdService.healthCheck();

            expect(result).toBe(false);
        });

        it('should return false when service returns error status', async () => {
            axios.get.mockResolvedValue({ status: 500 });

            const result = await lpdService.healthCheck();

            expect(result).toBe(false);
        });
    });
});
