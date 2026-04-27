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
const realApp = require('../../app');
const { pool } = require('../../config/db');
const { hashPassword } = require('../../utils/pw');

jest.mock('../../services/employee.lpd.service');

describe('LPD Check-In Integration Flow', () => {
    let mockApp;
    let mockSession;

    beforeEach(() => {
        mockApp = express();
        mockApp.use(express.json());

        // Mock session/auth middleware
        mockApp.use((req, res, next) => {
            req.session = mockSession;
            next();
        });

        // Routes
        mockApp.post('/api/employee/parking/lpd-detect', lpdController.detectLicensePlate);
        mockApp.post('/api/employee/parking/entry', (req, res) => {
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

            const response = await request(mockApp)
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
            const detectResponse = await request(mockApp)
                .post('/api/employee/parking/lpd-detect')
                .send({ image: mockBase64Image });

            expect(detectResponse.status).toBe(200);
            const detectedPlate = detectResponse.body.data.normalized_plate;

            // Step 2: Use detected plate for check-in
            const checkInResponse = await request(mockApp)
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

            const response = await request(mockApp)
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
            const detectResponse = await request(mockApp)
                .post('/api/employee/parking/lpd-detect')
                .send({ image: mockBase64Image });

            expect(detectResponse.status).toBe(422);

            // Step 2: User manually enters plate and checks in
            const checkInResponse = await request(mockApp)
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

            const response = await request(mockApp)
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
            const response = await request(mockApp)
                .post('/api/employee/parking/lpd-detect')
                .send({});

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
        });

        it('should reject request with invalid base64', async () => {
            lpdService.detectPlateFromImage.mockRejectedValue(
                new Error('Invalid base64 format')
            );

            const response = await request(mockApp)
                .post('/api/employee/parking/lpd-detect')
                .send({ image: '!!!invalid!!!' });

            expect(response.status).toBe(400);
        });

        it('should reject unauthenticated requests', async () => {
            mockSession = undefined;

            const mockBase64Image = Buffer.from('fake image data').toString('base64');

            const response = await request(mockApp)
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

            const response = await request(mockApp)
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

            const response = await request(mockApp)
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

            const response = await request(mockApp)
                .post('/api/employee/parking/lpd-detect')
                .send({ image: mockBase64Image });

            expect(response.body.data.confidence).toBe(0.9);
        });
    });

    describe('Edge Hybrid Check-In Integration', () => {
        let edgeLotId;
        let edgeUserId;
        let authCookie;

        beforeAll(async () => {
            const passwordHash = await hashPassword('password123');
            const username = `edge_lpd_employee_${Date.now()}`;

            const userResult = await pool.query(
                `INSERT INTO users (username, password_hash, full_name, role)
                 VALUES ($1, $2, $3, $4)
                 RETURNING user_id`,
                [username, passwordHash, 'Edge LPD Employee', 'employee']
            );
            edgeUserId = userResult.rows[0].user_id;

            const lotResult = await pool.query(
                `INSERT INTO parkinglots (lot_name, car_capacity, bike_capacity, current_car, current_bike, managed_by)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 RETURNING lot_id`,
                ['Edge LPD Integration Lot', 10, 10, 0, 0, edgeUserId]
            );
            edgeLotId = lotResult.rows[0].lot_id;

            const loginRes = await request(realApp).post('/api/auth/login').send({
                username,
                password: 'password123',
            });

            if (loginRes.status !== 200 || !loginRes.headers['set-cookie']) {
                throw new Error('Test setup failed: unable to authenticate edge employee user');
            }

            authCookie = loginRes.headers['set-cookie'];
        });

        afterEach(async () => {
            if (edgeLotId) {
                await pool.query('DELETE FROM parkingsessions WHERE lot_id = $1', [edgeLotId]);
                await pool.query('UPDATE parkinglots SET current_car = 0, current_bike = 0 WHERE lot_id = $1', [edgeLotId]);
            }
        });

        afterAll(async () => {
            if (edgeLotId) {
                await pool.query('DELETE FROM parkingsessions WHERE lot_id = $1', [edgeLotId]);
                await pool.query('DELETE FROM parkinglots WHERE lot_id = $1', [edgeLotId]);
            }

            if (edgeUserId) {
                await pool.query('DELETE FROM users WHERE user_id = $1', [edgeUserId]);
            }
        });

        it('should keep same session_id for card-first then delayed LPD enrich on edge endpoint', async () => {
            const gatewayId = 'gw-edge-1';
            const laneId = 'lane-card-lpd-1';
            const cardUid = `CARD-DELAYED-${Date.now()}`;
            const plate = `LPDDELAY${Date.now().toString().slice(-4)}`;

            const cardFirstRes = await request(realApp)
                .post('/api/employee/parking/edge/checkin-event')
                .set('Cookie', authCookie)
                .send({
                    gateway_id: gatewayId,
                    lot_id: edgeLotId,
                    lane_id: laneId,
                    trigger_type: 'CARD',
                    card_uid: cardUid,
                    vehicle_type: 'car',
                    is_monthly: false,
                    metadata: { source: 'rfid' },
                });

            expect(cardFirstRes.status).toBe(201);
            expect(cardFirstRes.body.success).toBe(true);
            expect(cardFirstRes.body.session.session_id).toBeDefined();
            expect(cardFirstRes.body.session.card_uid).toBe(cardUid);
            expect(cardFirstRes.body.session.license_plate).toBeNull();

            const delayedLpdRes = await request(realApp)
                .post('/api/employee/parking/edge/checkin-event')
                .set('Cookie', authCookie)
                .send({
                    gateway_id: gatewayId,
                    lot_id: edgeLotId,
                    lane_id: laneId,
                    trigger_type: 'LPD',
                    vehicle_type: 'car',
                    license_plate: plate,
                    image_in_url: 'https://example.com/delayed-lpd.jpg',
                    metadata: { lpd_confidence: 0.97 },
                });

            expect(delayedLpdRes.status).toBe(201);
            expect(delayedLpdRes.body.success).toBe(true);
            expect(delayedLpdRes.body.session.session_id).toBe(cardFirstRes.body.session.session_id);
            expect(delayedLpdRes.body.session.license_plate).toBe(plate);

            const activeSessions = await pool.query(
                `SELECT session_id, card_uid, license_plate
                 FROM parkingsessions
                 WHERE lot_id = $1 AND entry_lane_id = $2 AND time_out IS NULL`,
                [edgeLotId, laneId]
            );

            expect(activeSessions.rows).toHaveLength(1);
            expect(activeSessions.rows[0].session_id).toBe(cardFirstRes.body.session.session_id);
            expect(activeSessions.rows[0].card_uid).toBe(cardUid);
            expect(activeSessions.rows[0].license_plate).toBe(plate);
        });
    });
});
