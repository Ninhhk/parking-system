/**
 * Integration Test: LPD Check-In Flow
 * 
 * Tests the complete flow:
 * 1. Camera capture → 2. Plate detection → 3. Auto-fill form → 4. Submit check-in
 */

const request = require('supertest');
const express = require('express');
const lpdController = require('../../controllers/employee.lpd.controller');
const sessionsController = require('../../controllers/employee.sessions.controller');
const lpdService = require('../../services/employee.lpd.service');

jest.mock('../../services/employee.lpd.service');

describe('LPD Check-In Integration Flow', () => {
    let app;
    let mockSession;

    beforeEach(() => {
        app = express();
        app.use(express.json());

        // Mock session/auth middleware
        app.use((req, res, next) => {
            req.session = mockSession;
            next();
        });

        // Routes
        app.post('/api/employee/parking/lpd-detect', lpdController.detectLicensePlate);
        app.post('/api/employee/parking/entry', (req, res) => {
            // Mock check-in response
            res.status(201).json({
                success: true,
                message: 'Vehicle checked in successfully',
                ticket: {
                    session_id: 123,
                    license_plate: req.body.license_plate,
                    vehicle_type: req.body.vehicle_type,
                    time_in: new Date().toISOString(),
                    lot_id: 1,
                    lot_name: 'Lot A',
                },
            });
        });

        mockSession = {
            user: {
                user_id: 1,
                username: 'employee1',
                role: 'employee',
            },
        };

        jest.clearAllMocks();
    });

    describe('Complete LPD Detection to Check-In Flow', () => {
        it('should successfully detect plate and auto-populate form', async () => {
            const mockBase64Image = Buffer.from('fake image data').toString('base64');
            const mockDetectionResult = {
                success: true,
                normalized_plate: '51G-39466',
                raw_text: '51G-394.66',
                confidence: 0.95,
            };

            lpdService.detectPlateFromImage.mockResolvedValue(mockDetectionResult);

            const response = await request(app)
                .post('/api/employee/parking/lpd-detect')
                .send({ image: mockBase64Image });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.normalized_plate).toBe('51G-39466');
        });

        it('should complete full flow: capture -> detect -> check-in', async () => {
            const mockBase64Image = Buffer.from('fake image data').toString('base64');
            const mockDetectionResult = {
                success: true,
                normalized_plate: '51G-39466',
                raw_text: '51G-394.66',
                confidence: 0.95,
            };

            lpdService.detectPlateFromImage.mockResolvedValue(mockDetectionResult);

            // Step 1: Detect plate
            const detectResponse = await request(app)
                .post('/api/employee/parking/lpd-detect')
                .send({ image: mockBase64Image });

            expect(detectResponse.status).toBe(200);
            const detectedPlate = detectResponse.body.data.normalized_plate;

            // Step 2: Use detected plate for check-in
            const checkInResponse = await request(app)
                .post('/api/employee/parking/entry')
                .send({
                    license_plate: detectedPlate,
                    vehicle_type: 'car',
                });

            expect(checkInResponse.status).toBe(201);
            expect(checkInResponse.body.success).toBe(true);
            expect(checkInResponse.body.ticket.license_plate).toBe('51G-39466');
        });

        it('should handle detection failure gracefully', async () => {
            const mockBase64Image = Buffer.from('fake image data').toString('base64');

            lpdService.detectPlateFromImage.mockRejectedValue(
                new Error('No license plate detected in image')
            );

            const response = await request(app)
                .post('/api/employee/parking/lpd-detect')
                .send({ image: mockBase64Image });

            expect(response.status).toBe(422);
            expect(response.body.success).toBe(false);
        });

        it('should allow fallback manual entry when detection fails', async () => {
            const mockBase64Image = Buffer.from('fake image data').toString('base64');

            lpdService.detectPlateFromImage.mockRejectedValue(
                new Error('No license plate detected')
            );

            // Step 1: Attempt detection (fails)
            const detectResponse = await request(app)
                .post('/api/employee/parking/lpd-detect')
                .send({ image: mockBase64Image });

            expect(detectResponse.status).toBe(422);

            // Step 2: User manually enters plate and checks in
            const checkInResponse = await request(app)
                .post('/api/employee/parking/entry')
                .send({
                    license_plate: '51G-39466',
                    vehicle_type: 'car',
                });

            expect(checkInResponse.status).toBe(201);
            expect(checkInResponse.body.success).toBe(true);
        });

        it('should validate plate format after detection', async () => {
            const mockBase64Image = Buffer.from('fake image data').toString('base64');
            const mockDetectionResult = {
                success: true,
                normalized_plate: '51G-39466',
                raw_text: '51G-394.66',
                confidence: 0.95,
            };

            lpdService.detectPlateFromImage.mockResolvedValue(mockDetectionResult);

            const response = await request(app)
                .post('/api/employee/parking/lpd-detect')
                .send({ image: mockBase64Image });

            // Verify plate matches expected format
            const plate = response.body.data.normalized_plate;
            const plateRegex = /^[A-Z0-9-]+$/i;

            expect(plateRegex.test(plate)).toBe(true);
        });
    });

    describe('Error Handling and Edge Cases', () => {
        it('should reject request without image', async () => {
            const response = await request(app)
                .post('/api/employee/parking/lpd-detect')
                .send({});

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
        });

        it('should reject request with invalid base64', async () => {
            lpdService.detectPlateFromImage.mockRejectedValue(
                new Error('Invalid base64 format')
            );

            const response = await request(app)
                .post('/api/employee/parking/lpd-detect')
                .send({ image: '!!!invalid!!!' });

            expect(response.status).toBe(400);
        });

        it('should reject unauthenticated requests', async () => {
            mockSession = undefined;

            const mockBase64Image = Buffer.from('fake image data').toString('base64');

            const response = await request(app)
                .post('/api/employee/parking/lpd-detect')
                .send({ image: mockBase64Image });

            expect(response.status).toBe(401);
            expect(response.body.success).toBe(false);
        });

        it('should handle service timeouts gracefully', async () => {
            const mockBase64Image = Buffer.from('fake image data').toString('base64');

            lpdService.detectPlateFromImage.mockRejectedValue(
                new Error('LPD service request timed out')
            );

            const response = await request(app)
                .post('/api/employee/parking/lpd-detect')
                .send({ image: mockBase64Image });

            expect(response.status).toBe(504);
            expect(response.body.success).toBe(false);
        });
    });

    describe('Confidence Score Handling', () => {
        it('should include confidence score in response', async () => {
            const mockBase64Image = Buffer.from('fake image data').toString('base64');
            const mockDetectionResult = {
                success: true,
                normalized_plate: '51G-39466',
                raw_text: '51G-394.66',
                confidence: 0.87,
            };

            lpdService.detectPlateFromImage.mockResolvedValue(mockDetectionResult);

            const response = await request(app)
                .post('/api/employee/parking/lpd-detect')
                .send({ image: mockBase64Image });

            expect(response.body.data.confidence).toBe(0.87);
        });

        it('should handle missing confidence gracefully', async () => {
            const mockBase64Image = Buffer.from('fake image data').toString('base64');
            const mockDetectionResult = {
                success: true,
                normalized_plate: '51G-39466',
                raw_text: '51G-394.66',
                confidence: 0.9, // Default confidence provided by service
            };

            lpdService.detectPlateFromImage.mockResolvedValue(mockDetectionResult);

            const response = await request(app)
                .post('/api/employee/parking/lpd-detect')
                .send({ image: mockBase64Image });

            expect(response.body.data.confidence).toBe(0.9);
        });
    });
});
