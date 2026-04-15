const request = require("supertest");
const app = require("../../app");
const { pool } = require("../../config/db");
const sessionsRepo = require("../../repositories/employee.sessions.repo");
const edgeCheckinService = require("../../services/edge.checkin.service");
const { hashPassword } = require("../../utils/pw");

describe("Check-in Concurrency Tests", () => {
    let testLotId;
    let testUserId;
    let authCookie;

    beforeAll(async () => {
        const passwordHash = await hashPassword("password123");

        // Create test user (employee)
        const userResult = await pool.query(
            `INSERT INTO users (username, password_hash, full_name, role) 
             VALUES ($1, $2, $3, $4) 
             RETURNING user_id`,
            ["test_employee_concurrency", passwordHash, "Test Employee", "employee"]
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
        if (loginRes.status !== 200 || !loginRes.headers["set-cookie"]) {
            throw new Error("Test setup failed: unable to authenticate test employee user");
        }
        authCookie = loginRes.headers["set-cookie"];
    });

    afterAll(async () => {
        // Clean up test data
        await pool.query("DELETE FROM parkingsessions WHERE lot_id = $1", [testLotId]);
        await pool.query("DELETE FROM parkinglots WHERE lot_id = $1", [testLotId]);
        await pool.query("DELETE FROM users WHERE user_id = $1", [testUserId]);

        // Ensure open pg handles are closed for this file.
        await pool.end();
    });

    afterEach(async () => {
        // Clean up sessions after each test
        await pool.query("DELETE FROM parkingsessions WHERE lot_id = $1", [testLotId]);
        await pool.query("UPDATE parkinglots SET current_car = 0, current_bike = 0 WHERE lot_id = $1", [testLotId]);
    });

    describe("Hybrid Edge Check-in Schema", () => {
        test("parkingsessions includes hybrid identifier and metadata columns", async () => {
            const columnsResult = await pool.query(
                `SELECT column_name, is_nullable, data_type, udt_name, column_default
                 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'parkingsessions'`
            );

            const columnsByName = columnsResult.rows.reduce((acc, row) => {
                acc[row.column_name] = row;
                return acc;
            }, {});

            expect(columnsByName.license_plate).toBeDefined();
            expect(columnsByName.license_plate.is_nullable).toBe("YES");

            expect(columnsByName.card_uid).toBeDefined();
            expect(columnsByName.card_uid.is_nullable).toBe("YES");

            expect(columnsByName.etag_epc).toBeDefined();
            expect(columnsByName.etag_epc.is_nullable).toBe("YES");

            expect(columnsByName.entry_lane_id).toBeDefined();
            expect(columnsByName.entry_lane_id.is_nullable).toBe("YES");

            expect(columnsByName.image_in_url).toBeDefined();
            expect(columnsByName.image_in_url.is_nullable).toBe("YES");

            expect(columnsByName.image_out_url).toBeDefined();
            expect(columnsByName.image_out_url.is_nullable).toBe("YES");

            expect(columnsByName.metadata_in).toBeDefined();
            expect(columnsByName.metadata_in.data_type).toBe("jsonb");
            expect(columnsByName.metadata_in.udt_name).toBe("jsonb");
            expect(columnsByName.metadata_in.column_default).toContain("{}::jsonb");

            expect(columnsByName.metadata_out).toBeDefined();
            expect(columnsByName.metadata_out.data_type).toBe("jsonb");
            expect(columnsByName.metadata_out.udt_name).toBe("jsonb");
            expect(columnsByName.metadata_out.column_default).toContain("{}::jsonb");
        });

        test("parkingsessions includes required partial indexes for hybrid check-in", async () => {
            const indexesResult = await pool.query(
                `SELECT indexname, indexdef
                 FROM pg_indexes
                 WHERE schemaname = 'public'
                   AND tablename = 'parkingsessions'
                   AND indexname IN (
                        'uq_active_session_plate',
                        'uq_active_session_card_uid',
                        'uq_active_session_etag_epc',
                        'idx_active_session_entry_lane_timein'
                   )`
            );

            const indexesByName = indexesResult.rows.reduce((acc, row) => {
                acc[row.indexname] = row.indexdef.toLowerCase().replace(/\s+/g, " ").trim();
                return acc;
            }, {});

            expect(indexesByName.uq_active_session_plate).toBeDefined();
            expect(indexesByName.uq_active_session_plate).toContain("time_out is null");
            expect(indexesByName.uq_active_session_plate).toContain("license_plate is not null");

            expect(indexesByName.uq_active_session_card_uid).toBeDefined();
            expect(indexesByName.uq_active_session_card_uid).toContain("time_out is null");
            expect(indexesByName.uq_active_session_card_uid).toContain("card_uid is not null");

            expect(indexesByName.uq_active_session_etag_epc).toBeDefined();
            expect(indexesByName.uq_active_session_etag_epc).toContain("time_out is null");
            expect(indexesByName.uq_active_session_etag_epc).toContain("etag_epc is not null");

            expect(indexesByName.idx_active_session_entry_lane_timein).toBeDefined();
            expect(indexesByName.idx_active_session_entry_lane_timein).toContain("entry_lane_id");
            expect(indexesByName.idx_active_session_entry_lane_timein).toContain("time_in desc");
            expect(indexesByName.idx_active_session_entry_lane_timein).toContain("time_out is null");
        });
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

        test("should prevent duplicate active sessions for same card_uid", async () => {
            const cardUid = "CARD-UID-001";

            const first = await sessionsRepo.startSession({
                lot_id: testLotId,
                license_plate: null,
                card_uid: cardUid,
                vehicle_type: "car",
                is_monthly: false,
            });
            expect(first).not.toBeNull();

            await expect(
                sessionsRepo.startSession({
                    lot_id: testLotId,
                    license_plate: null,
                    card_uid: cardUid,
                    vehicle_type: "car",
                    is_monthly: false,
                })
            ).rejects.toThrow();

            const sessions = await pool.query(
                "SELECT COUNT(*) FROM parkingsessions WHERE card_uid = $1 AND time_out IS NULL",
                [cardUid]
            );
            expect(parseInt(sessions.rows[0].count, 10)).toBe(1);
        });

        test("should prevent duplicate active sessions for same etag_epc", async () => {
            const etagEpc = "EPC-001";

            const first = await sessionsRepo.startSession({
                lot_id: testLotId,
                license_plate: null,
                etag_epc: etagEpc,
                vehicle_type: "bike",
                is_monthly: false,
            });
            expect(first).not.toBeNull();

            await expect(
                sessionsRepo.startSession({
                    lot_id: testLotId,
                    license_plate: null,
                    etag_epc: etagEpc,
                    vehicle_type: "bike",
                    is_monthly: false,
                })
            ).rejects.toThrow();

            const sessions = await pool.query(
                "SELECT COUNT(*) FROM parkingsessions WHERE etag_epc = $1 AND time_out IS NULL",
                [etagEpc]
            );
            expect(parseInt(sessions.rows[0].count, 10)).toBe(1);
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

    describe("Hybrid Lane Enrichment", () => {
        test("delayed LPD enrich updates same active session in lane within 5 seconds", async () => {
            const entryLaneId = "lane-a";
            const started = await sessionsRepo.startSession({
                lot_id: testLotId,
                vehicle_type: "car",
                is_monthly: false,
                license_plate: null,
                card_uid: "CARD-LPD-001",
                entry_lane_id: entryLaneId,
                metadata_in: { source: "rfid" },
            });

            expect(started).not.toBeNull();
            expect(started.license_plate).toBeNull();

            const enriched = await sessionsRepo.enrichRecentSessionByLane({
                entry_lane_id: entryLaneId,
                license_plate: "LPD123",
                image_in_url: "https://example.com/in.jpg",
                metadata_patch: { lpd_confidence: 0.97 },
            });

            expect(enriched).not.toBeNull();
            expect(enriched.session_id).toBe(started.session_id);
            expect(enriched.license_plate).toBe("LPD123");
            expect(enriched.image_in_url).toBe("https://example.com/in.jpg");
            expect(enriched.metadata_in).toMatchObject({
                source: "rfid",
                lpd_confidence: 0.97,
            });
        });

        test("card + LPD concurrent same lane => one active session", async () => {
            const gatewayId = "gw-edge-1";
            const laneId = "lane-concurrent-1";
            const cardEvent = {
                gateway_id: gatewayId,
                lot_id: testLotId,
                lane_id: laneId,
                trigger_type: "CARD",
                card_uid: "CARD-CONCURRENT-001",
                vehicle_type: "car",
                is_monthly: false,
                metadata: { source: "rfid" },
            };

            const lpdEvent = {
                gateway_id: gatewayId,
                lot_id: testLotId,
                lane_id: laneId,
                trigger_type: "LPD",
                license_plate: "LPD-CONCURRENT-001",
                image_in_url: "https://example.com/concurrent.jpg",
                vehicle_type: "car",
                is_monthly: false,
                metadata: { lpd_confidence: 0.96 },
            };

            await Promise.all([
                edgeCheckinService.ingestCheckinEvent(cardEvent),
                edgeCheckinService.ingestCheckinEvent(lpdEvent),
            ]);

            const sessions = await pool.query(
                `SELECT *
                 FROM parkingsessions
                 WHERE lot_id = $1 AND entry_lane_id = $2 AND time_out IS NULL
                 ORDER BY time_in DESC`,
                [testLotId, laneId]
            );

            expect(sessions.rows).toHaveLength(1);
            expect(sessions.rows[0].card_uid).toBe("CARD-CONCURRENT-001");
            expect(sessions.rows[0].license_plate).toBe("LPD-CONCURRENT-001");
            expect(sessions.rows[0].metadata_in).toMatchObject({
                source: "rfid",
                lpd_confidence: 0.96,
            });
        });

        test("rejects UHF trigger when lane module is disabled", async () => {
            await expect(
                edgeCheckinService.ingestCheckinEvent({
                    gateway_id: "gw-edge-1",
                    lane_id: "lane-card-lpd-1",
                    trigger_type: "UHF",
                    lot_id: testLotId,
                    vehicle_type: "car",
                    etag_epc: "EPC-DISABLED-001",
                })
            ).rejects.toMatchObject({
                status: 422,
                publicMessage: "Lane module disabled",
            });
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
