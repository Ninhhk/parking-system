const request = require("supertest");
const app = require("../../app");
const { pool } = require("../../config/db");
const sessionsRepo = require("../../repositories/employee.sessions.repo");

describe("Check-in Concurrency Tests", () => {
    let testLotId;
    let testUserId;
    let authCookie;

    beforeAll(async () => {
        // Create test user (employee)
        const userResult = await pool.query(
            `INSERT INTO users (username, password_hash, full_name, role) 
             VALUES ($1, $2, $3, $4) 
             RETURNING user_id`,
            ["test_employee_concurrency", "hash", "Test Employee", "employee"]
        );
        testUserId = userResult.rows[0].user_id;

        // Create test parking lot with limited capacity
        const lotResult = await pool.query(
            `INSERT INTO parkinglots (lot_name, car_capacity, bike_capacity, current_car, current_bike, managed_by)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING lot_id`,
            ["Test Lot Concurrency", 2, 2, 0, 0, testUserId]
        );
        testLotId = lotResult.rows[0].lot_id;

        // Login to get session cookie
        const loginRes = await request(app).post("/api/auth/login").send({
            username: "test_employee_concurrency",
            password: "password123",
        });
        authCookie = loginRes.headers["set-cookie"];
    });

    afterAll(async () => {
        // Clean up test data
        await pool.query("DELETE FROM parkingsessions WHERE lot_id = $1", [testLotId]);
        await pool.query("DELETE FROM parkinglots WHERE lot_id = $1", [testLotId]);
        await pool.query("DELETE FROM users WHERE user_id = $1", [testUserId]);
        await pool.end();
    });

    afterEach(async () => {
        // Clean up sessions after each test
        await pool.query("DELETE FROM parkingsessions WHERE lot_id = $1", [testLotId]);
        await pool.query("UPDATE parkinglots SET current_car = 0, current_bike = 0 WHERE lot_id = $1", [testLotId]);
    });

    describe("Capacity Enforcement", () => {
        test("should enforce car capacity limit atomically", async () => {
            // Set capacity to 2 cars
            const plates = ["ABC123", "DEF456", "GHI789"];

            // Try to check in 3 cars when capacity is only 2
            const results = await Promise.all(
                plates.map((plate) =>
                    sessionsRepo
                        .startSession({
                            lot_id: testLotId,
                            license_plate: plate,
                            vehicle_type: "car",
                            is_monthly: false,
                        })
                        .catch((err) => null)
                )
            );

            // Exactly 2 should succeed, 1 should return null (capacity full)
            const successCount = results.filter((r) => r !== null).length;
            expect(successCount).toBe(2);

            // Verify database state
            const lotState = await pool.query("SELECT current_car FROM parkinglots WHERE lot_id = $1", [testLotId]);
            expect(lotState.rows[0].current_car).toBe(2);
        });

        test("should enforce bike capacity limit atomically", async () => {
            const plates = ["BIKE1", "BIKE2", "BIKE3"];

            const results = await Promise.all(
                plates.map((plate) =>
                    sessionsRepo
                        .startSession({
                            lot_id: testLotId,
                            license_plate: plate,
                            vehicle_type: "bike",
                            is_monthly: false,
                        })
                        .catch((err) => null)
                )
            );

            const successCount = results.filter((r) => r !== null).length;
            expect(successCount).toBe(2);

            const lotState = await pool.query("SELECT current_bike FROM parkinglots WHERE lot_id = $1", [testLotId]);
            expect(lotState.rows[0].current_bike).toBe(2);
        });

        test("should handle mixed car and bike check-ins independently", async () => {
            const cars = ["CAR1", "CAR2"];
            const bikes = ["BIKE1", "BIKE2"];

            const carResults = await Promise.all(
                cars.map((plate) =>
                    sessionsRepo.startSession({
                        lot_id: testLotId,
                        license_plate: plate,
                        vehicle_type: "car",
                        is_monthly: false,
                    })
                )
            );

            const bikeResults = await Promise.all(
                bikes.map((plate) =>
                    sessionsRepo.startSession({
                        lot_id: testLotId,
                        license_plate: plate,
                        vehicle_type: "bike",
                        is_monthly: false,
                    })
                )
            );

            expect(carResults.every((r) => r !== null)).toBe(true);
            expect(bikeResults.every((r) => r !== null)).toBe(true);

            const lotState = await pool.query(
                "SELECT current_car, current_bike FROM parkinglots WHERE lot_id = $1",
                [testLotId]
            );
            expect(lotState.rows[0].current_car).toBe(2);
            expect(lotState.rows[0].current_bike).toBe(2);
        });
    });

    describe("Duplicate Session Prevention", () => {
        test("should prevent duplicate active sessions for same license plate", async () => {
            const plate = "DUP123";

            // First check-in should succeed
            const first = await sessionsRepo.startSession({
                lot_id: testLotId,
                license_plate: plate,
                vehicle_type: "car",
                is_monthly: false,
            });
            expect(first).not.toBeNull();

            // Second check-in with same plate should fail with unique constraint error
            await expect(
                sessionsRepo.startSession({
                    lot_id: testLotId,
                    license_plate: plate,
                    vehicle_type: "car",
                    is_monthly: false,
                })
            ).rejects.toThrow();

            // Verify only one session exists
            const sessions = await pool.query(
                "SELECT COUNT(*) FROM parkingsessions WHERE license_plate = $1 AND time_out IS NULL",
                [plate]
            );
            expect(parseInt(sessions.rows[0].count)).toBe(1);
        });

        test("should handle concurrent duplicate attempts gracefully via API", async () => {
            if (!authCookie) {
                console.log("Skipping API test - no auth cookie");
                return;
            }

            const plate = "CONCURRENT123";

            // Make multiple concurrent requests
            const requests = Array(5)
                .fill(null)
                .map(() =>
                    request(app)
                        .post("/api/employee/sessions/checkin")
                        .set("Cookie", authCookie)
                        .send({
                            license_plate: plate,
                            vehicle_type: "car",
                            lot_id: testLotId,
                        })
                        .then((res) => ({ status: res.status, success: res.body.success }))
                        .catch((err) => ({ status: 500, success: false }))
                );

            const results = await Promise.all(requests);

            // Exactly one should succeed (201), others should return 409 Conflict
            const successCount = results.filter((r) => r.status === 201).length;
            const conflictCount = results.filter((r) => r.status === 409).length;

            expect(successCount).toBe(1);
            expect(conflictCount).toBeGreaterThan(0);

            // Verify only one session in database
            const sessions = await pool.query(
                "SELECT COUNT(*) FROM parkingsessions WHERE license_plate = $1 AND time_out IS NULL",
                [plate]
            );
            expect(parseInt(sessions.rows[0].count)).toBe(1);
        });
    });

    describe("Capacity Full API Response", () => {
        test("should return 409 Conflict when lot is full", async () => {
            if (!authCookie) {
                console.log("Skipping API test - no auth cookie");
                return;
            }

            // Fill the lot to capacity
            await sessionsRepo.startSession({
                lot_id: testLotId,
                license_plate: "FULL1",
                vehicle_type: "car",
                is_monthly: false,
            });
            await sessionsRepo.startSession({
                lot_id: testLotId,
                license_plate: "FULL2",
                vehicle_type: "car",
                is_monthly: false,
            });

            // Try to check in one more car
            const res = await request(app)
                .post("/api/employee/sessions/checkin")
                .set("Cookie", authCookie)
                .send({
                    license_plate: "FULL3",
                    vehicle_type: "car",
                    lot_id: testLotId,
                });

            expect(res.status).toBe(409);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toContain("full");
        });
    });

    describe("Monthly Subscription with Capacity", () => {
        test("monthly subscription vehicles should still respect capacity limits", async () => {
            // Create monthly subscription
            const subResult = await pool.query(
                `INSERT INTO monthlysubs (license_plate, vehicle_type, start_date, end_date, owner_name, owner_phone)
                 VALUES ($1, $2, CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days', $3, $4)
                 RETURNING sub_id`,
                ["MONTHLY1", "car", "Monthly Owner", "123456"]
            );

            // Fill lot to capacity with regular vehicles
            await sessionsRepo.startSession({
                lot_id: testLotId,
                license_plate: "REG1",
                vehicle_type: "car",
                is_monthly: false,
            });
            await sessionsRepo.startSession({
                lot_id: testLotId,
                license_plate: "REG2",
                vehicle_type: "car",
                is_monthly: false,
            });

            // Try to check in monthly subscription vehicle - should fail (capacity full)
            const result = await sessionsRepo.startSession({
                lot_id: testLotId,
                license_plate: "MONTHLY1",
                vehicle_type: "car",
                is_monthly: true,
            });

            expect(result).toBeNull();

            // Clean up
            await pool.query("DELETE FROM monthlysubs WHERE sub_id = $1", [subResult.rows[0].sub_id]);
        });
    });
});
