import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { detectLicensePlate, isLPDServiceAvailable } from '../api/employee.lpd.client';
import api from '../api/client.config';

// Mock the api client
jest.mock('../api/client.config');

describe('Employee LPD Client', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('detectLicensePlate', () => {
        it('should successfully detect plate from base64 image', async () => {
            const mockBase64 = Buffer.from('test image').toString('base64');
            const mockResponse = {
                data: {
                    success: true,
                    data: {
                        normalized_plate: '51G-39466',
                        raw_text: '51G-394.66',
                        confidence: 0.95,
                    },
                },
            };

            api.post.mockResolvedValue(mockResponse);

            const result = await detectLicensePlate(mockBase64);

            expect(result).toEqual({
                success: true,
                normalized_plate: '51G-39466',
                raw_text: '51G-394.66',
                confidence: 0.95,
            });

            expect(api.post).toHaveBeenCalledWith(
                '/employee/parking/lpd-detect',
                { image: mockBase64 }
            );
        });

        it('should throw error when image is empty', async () => {
            await expect(detectLicensePlate(''))
                .rejects
                .toThrow('Image must be a valid base64-encoded string');

            expect(api.post).not.toHaveBeenCalled();
        });

        it('should throw error when image is not a string', async () => {
            await expect(detectLicensePlate(12345))
                .rejects
                .toThrow('Image must be a valid base64-encoded string');

            expect(api.post).not.toHaveBeenCalled();
        });

        it('should throw error when response is not successful', async () => {
            const mockBase64 = Buffer.from('test image').toString('base64');
            const mockResponse = {
                data: {
                    success: false,
                    message: 'No plate detected',
                },
            };

            api.post.mockResolvedValue(mockResponse);

            await expect(detectLicensePlate(mockBase64))
                .rejects
                .toThrow('No plate detected');
        });

        it('should throw error when API call fails', async () => {
            const mockBase64 = Buffer.from('test image').toString('base64');

            api.post.mockRejectedValue(
                new Error('Network error')
            );

            await expect(detectLicensePlate(mockBase64))
                .rejects
                .toThrow();
        });

        it('should throw error when normalized_plate is missing', async () => {
            const mockBase64 = Buffer.from('test image').toString('base64');
            const mockResponse = {
                data: {
                    success: true,
                    data: {
                        // missing normalized_plate
                        confidence: 0.5,
                    },
                },
            };

            api.post.mockResolvedValue(mockResponse);

            await expect(detectLicensePlate(mockBase64))
                .rejects
                .toThrow('No license plate detected in image');
        });

        it('should use default confidence when not provided', async () => {
            const mockBase64 = Buffer.from('test image').toString('base64');
            const mockResponse = {
                data: {
                    success: true,
                    data: {
                        normalized_plate: '51G-39466',
                        // confidence not provided
                    },
                },
            };

            api.post.mockResolvedValue(mockResponse);

            const result = await detectLicensePlate(mockBase64);

            expect(result.confidence).toBe(0.9);
        });

        it('should use normalized_plate as raw_text when raw_text is missing', async () => {
            const mockBase64 = Buffer.from('test image').toString('base64');
            const mockResponse = {
                data: {
                    success: true,
                    data: {
                        normalized_plate: '51G-39466',
                        // raw_text not provided
                    },
                },
            };

            api.post.mockResolvedValue(mockResponse);

            const result = await detectLicensePlate(mockBase64);

            expect(result.raw_text).toBe('51G-39466');
        });

        it('should handle API error response with message', async () => {
            const mockBase64 = Buffer.from('test image').toString('base64');

            api.post.mockRejectedValue({
                response: {
                    data: {
                        message: 'Backend error: LPD service unavailable',
                    },
                },
            });

            await expect(detectLicensePlate(mockBase64))
                .rejects
                .toThrow('Backend error: LPD service unavailable');
        });
    });

    describe('isLPDServiceAvailable', () => {
        it('should return true when called', async () => {
            const result = await isLPDServiceAvailable();
            expect(result).toBe(true);
        });
    });
});
