const request = require('supertest');
const express = require('express');
const lpdController = require('../controllers/employee.lpd.controller');
const lpdService = require('../services/employee.lpd.service');

jest.mock('../services/employee.lpd.service');

describe('Employee LPD Controller', () => {
    let app;
    let mockReq;
    let mockRes;

    beforeEach(() => {
        app = express();
        app.use(express.json());

        mockReq = {};
        mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
        };

        jest.clearAllMocks();
    });

    describe('detectLicensePlate', () => {
        it('should detect license plate from base64 image successfully', async () => {
            const mockBase64Image = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
            const mockDetectionResult = {
                success: true,
                normalized_plate: '51G-39466',
                raw_text: '51G-39466',
                confidence: 0.95,
            };

            lpdService.detectPlateFromImage.mockResolvedValue(mockDetectionResult);

            mockReq.body = { image: mockBase64Image };
            mockReq.session = { user: { user_id: 1 } };

            await lpdController.detectLicensePlate(mockReq, mockRes);

            expect(lpdService.detectPlateFromImage).toHaveBeenCalledWith(mockBase64Image);
            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: true,
                data: mockDetectionResult,
            });
        });

        it('should return 400 when image is missing', async () => {
            mockReq.body = {};
            mockReq.session = { user: { user_id: 1 } };

            await lpdController.detectLicensePlate(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                message: 'Image data is required',
            });
        });

        it('should return 400 when image is invalid base64', async () => {
            mockReq.body = { image: 'not-valid-base64!!!' };
            mockReq.session = { user: { user_id: 1 } };

            lpdService.detectPlateFromImage.mockRejectedValue(
                new Error('Invalid base64 format')
            );

            await lpdController.detectLicensePlate(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                message: 'Invalid image format or encoding',
            });
        });

        it('should return 422 when plate detection fails', async () => {
            const mockBase64Image = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

            lpdService.detectPlateFromImage.mockRejectedValue(
                new Error('No license plate detected in image')
            );

            mockReq.body = { image: mockBase64Image };
            mockReq.session = { user: { user_id: 1 } };

            await lpdController.detectLicensePlate(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(422);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                message: 'No license plate detected in image',
            });
        });

        it('should return 500 on internal service error', async () => {
            const mockBase64Image = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

            lpdService.detectPlateFromImage.mockRejectedValue(
                new Error('Internal service error')
            );

            mockReq.body = { image: mockBase64Image };
            mockReq.session = { user: { user_id: 1 } };

            await lpdController.detectLicensePlate(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                message: 'Failed to process license plate detection',
            });
        });

        it('should return 401 when user is not authenticated', async () => {
            const mockBase64Image = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

            mockReq.body = { image: mockBase64Image };
            mockReq.session = undefined;

            await lpdController.detectLicensePlate(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(401);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                message: 'Unauthorized: User not authenticated',
            });
        });

        it('should include confidence score in response when available', async () => {
            const mockBase64Image = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
            const mockDetectionResult = {
                success: true,
                normalized_plate: '51G-39466',
                raw_text: '51G-39466',
                confidence: 0.87,
            };

            lpdService.detectPlateFromImage.mockResolvedValue(mockDetectionResult);

            mockReq.body = { image: mockBase64Image };
            mockReq.session = { user: { user_id: 1 } };

            await lpdController.detectLicensePlate(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: true,
                data: expect.objectContaining({
                    confidence: 0.87,
                    normalized_plate: '51G-39466',
                }),
            });
        });
    });
});
