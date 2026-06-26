const request = require("supertest");
const app = require("../../app");
const { pool } = require("../../config/db");
const { hashPassword } = require("../../utils/pw");

// Hot-path concurrency guarantee for issued-card check-in (Requirement 10.1, 10.2):
// the existing uq_active_session_card_uid partial unique index is the single source
// of truth that one physical card cannot back two simultaneous active sessions.
// This test reuses that index (no new mechanism) and asserts that N concurrent
// casual issued-card check-ins with the same card_uid produce exactly one 201,
// the rest 409, and a single active session row.
describe("Issued-card Check-in Concurrency (Card Pool)", () => {
    let testLotId;
    let testUserId;
    let authCookie;
    const CARD_UID = "POOL-CONCURRENCY-001";

    beforeAll(async () => {
        const passwordHash = await hashPassword("password123");

        // Create test user (employee)
        const userResult = await pool.query(
            `INSERT INTO users (username, password_hash, full_name, role)
             VALUES ($1, $2, $3, $4)
             RETURNING user_id`,
            ["test_employee_cardpool_concurrency", passwordHash, "Test Employee", "employee"]
        );
        testUserId = userResult.rows[0].user_id;

        // Capacity well above N so the active-card index — not capacity — is the only
        // possible source of rejection. Lot runs in issued_card mode for realism.
        const lotResult = await pool.query(
            `INSERT INTO parkinglots (lot_name, car_capacity, bike_capacity, current_car, current_bike, managed_by, casual_entry_mode)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING lot_id`,
            ["Test Lot Card Pool Concurrency", 20, 20, 0, 0, testUserId, "issued_card"]
        );
        testLotId = lotResult.rows[0].lot_id;

        // Seed a single available pool card bound to the test lot.
        await pool.query(
            "INSERT INTO parking_cards (card_uid, lot_id, status) VALUES ($1, $2, 'available')",
            [CARD_UID, testLotId]
        );

        // Login to get session cookie
        const loginRes = await request(app).post("/api/auth/login").send({
            username: "test_employee_cardpool_concurrency",
            password: "password123",
        });
        if (loginRes.status !== 200 || !loginRes.headers["set-cookie"]) {
            throw new Error("Test setup failed: unable to authenticate test employee user");
        }
        authCookie = loginRes.headers["set-cookie"];
    });

    afterAll(async () => {
        // Clean up test data (sessions first due to FK ordering)
        await pool.query("DELETE FROM parkingsessions WHERE lot_id = $1", [testLotId]);
        await pool.query("DELETE FROM parking_cards WHERE card_uid = $1", [CARD_UID]);
        await pool.query("DELETE FROM parkinglots WHERE lot_id = $1", [testLotId]);
        await pool.query("DELETE FROM users WHERE user_id = $1", [testUserId]);

        // Ensure open pg handles are closed for this file.
        await pool.end();
    });

    afterEach(async () => {
        // Reset sessions and counters between tests
        await pool.query("DELETE FROM parkingsessions WHERE lot_id = $1", [testLotId]);
        await pool.query("UPDATE parkinglots SET current_car = 0, current_bike = 0 WHERE lot_id = $1", [testLotId]);
    });

    test("N concurrent issued-card check-ins with the same card_uid yield exactly one 201, the rest 409, and one active session row", async () => {
        const N = 5;

        // Fire N concurrent casual issued-card check-ins for the same card.
        const requests = Array(N)
            .fill(null)
            .map(() =>
                request(app)
                    .post("/api/employee/parking/entry")
                    .set("Cookie", authCookie)
                    .send({
                        card_uid: CARD_UID,
                        vehicle_type: "car",
                        lot_id: testLotId,
                        metadata_in: { entry_type: "casual" },
                    })
                    .then((res) => res.status)
                    .catch(() => 500)
            );

        const statuses = await Promise.all(requests);

        const successCount = statuses.filter((s) => s === 201).length;
        const conflictCount = statuses.filter((s) => s === 409).length;

        // Exactly one check-in creates an active session; the rest are rejected 409.
        expect(successCount).toBe(1);
        expect(conflictCount).toBe(N - 1);

        // Exactly one active session row backs the card.
        const sessions = await pool.query(
            "SELECT COUNT(*) FROM parkingsessions WHERE card_uid = $1 AND time_out IS NULL",
            [CARD_UID]
        );
        expect(parseInt(sessions.rows[0].count, 10)).toBe(1);
    });
});
