// Integration test for the lost-marking fail-closed guarantee (Requirement 9.4).
// Exercises the REAL check-in controller + repos against Docker Postgres (no mocks).
//
// Scenario reproduced: a pool card backs an active session that is finalized as a
// lost ticket, but the markLost step FAILED — so the card's pool status is still
// 'available' (NOT 'lost'). The fail-closed guarantee is that a subsequent
// issued-card check-in presenting the same card_uid is still rejected, because the
// prior (now lost-finalized) session still backs the card via the
// uq_active_session_card_uid partial index → 409.
//
// "markLost failed" is modeled by its resulting DB state — the lost-ticket report
// is filed and the session is marked is_lost, but the card row is left 'available'
// (which is exactly what the table looks like when markLost throws yet the report
// itself succeeded, per the controller's best-effort try/catch). No repo is mocked.
//
// Requires Docker Postgres on port 55432; run with --runInBand --forceExit:
//   DB_HOST=localhost DB_PORT=55432 DB_USER=admin DB_PASSWORD=password123 \
//     DB_NAME=parking_lot npx jest lostMarking.failClosed.integration --runInBand --forceExit
//
// Validates: Requirements 9.4

const request = require("supertest");
const app = require("../../app");
const { pool } = require("../../config/db");
const sessionsRepo = require("../../repositories/employee.sessions.repo");
const parkingCardsRepo = require("../../repositories/parkingCards.repo");
const { hashPassword } = require("../../utils/pw");

const STAMP = Date.now();
const USERNAME = `it_failclosed_${STAMP}`;
const LOT_NAME = `IT FailClosed Lot ${STAMP}`;
const CARD_UID = `IT-FC-${STAMP}`;

describe("Lost-marking fail-closed (integration)", () => {
    let testUserId;
    let testLotId;
    let authCookie;

    beforeAll(async () => {
        const passwordHash = await hashPassword("password123");

        const userResult = await pool.query(
            `INSERT INTO users (username, password_hash, full_name, role)
             VALUES ($1, $2, $3, 'employee')
             RETURNING user_id`,
            [USERNAME, passwordHash, "IT FailClosed Employee"]
        );
        testUserId = userResult.rows[0].user_id;

        // Lot in issued_card mode, managed by the test employee, with ample capacity.
        const lotResult = await pool.query(
            `INSERT INTO parkinglots (lot_name, car_capacity, bike_capacity, current_car, current_bike, managed_by, casual_entry_mode)
             VALUES ($1, 10, 10, 0, 0, $2, 'issued_card')
             RETURNING lot_id`,
            [LOT_NAME, testUserId]
        );
        testLotId = lotResult.rows[0].lot_id;

        // Pool card bound to this lot, available.
        await parkingCardsRepo.insertPoolCard(CARD_UID, testLotId);

        const loginRes = await request(app).post("/api/auth/login").send({
            username: USERNAME,
            password: "password123",
        });
        if (loginRes.status !== 200 || !loginRes.headers["set-cookie"]) {
            throw new Error("Test setup failed: unable to authenticate test employee user");
        }
        authCookie = loginRes.headers["set-cookie"];
    });

    afterAll(async () => {
        // LostTicketReport rows cascade when their session is deleted.
        await pool.query("DELETE FROM parkingsessions WHERE lot_id = $1", [testLotId]);
        await pool.query("DELETE FROM parking_cards WHERE card_uid = $1", [CARD_UID]);
        await pool.query("DELETE FROM parkinglots WHERE lot_id = $1", [testLotId]);
        await pool.query("DELETE FROM users WHERE user_id = $1", [testUserId]);
        await pool.end();
    });

    test("card with failed lost-marking still backing a lost-finalized session rejects the next issued-card check-in (9.4)", async () => {
        const checkInBody = {
            card_uid: CARD_UID,
            vehicle_type: "car",
            metadata_in: { entry_type: "casual" },
        };

        // 1) First issued-card check-in succeeds and binds the active session to the card.
        const firstCheckIn = await request(app)
            .post("/api/employee/parking/entry")
            .set("Cookie", authCookie)
            .send(checkInBody);

        expect(firstCheckIn.status).toBe(201);
        const sessionId = firstCheckIn.body.ticket.session_id;
        expect(sessionId).toBeDefined();

        // 2) Finalize the session as a lost ticket, but DO NOT mark the card lost —
        //    this is the exact DB state left behind when markLost fails.
        await sessionsRepo.reportLostTicket({
            session_id: sessionId,
            guest_identification: "IT-FC-GUEST",
            guest_phone: "0900000000",
        });
        await sessionsRepo.syncLostTicketStatus(sessionId);

        // Confirm the failed-markLost precondition: card status is still 'available'.
        const cardAfter = await parkingCardsRepo.getPoolCard(CARD_UID);
        expect(cardAfter.status).toBe("available");

        // And the lost-finalized session is still active (time_out NULL) and backs the card.
        const activeBefore = await pool.query(
            "SELECT is_lost, time_out FROM parkingsessions WHERE session_id = $1",
            [sessionId]
        );
        expect(activeBefore.rows[0].is_lost).toBe(true);
        expect(activeBefore.rows[0].time_out).toBeNull();

        // 3) Fail-closed: the next issued-card check-in with the same card is rejected (409),
        //    because the prior session still backs the card via uq_active_session_card_uid.
        const secondCheckIn = await request(app)
            .post("/api/employee/parking/entry")
            .set("Cookie", authCookie)
            .send(checkInBody);

        expect(secondCheckIn.status).toBe(409);
        expect(secondCheckIn.body.success).toBe(false);

        // Only one active session for this card exists — no duplicate was created.
        const activeCount = await pool.query(
            "SELECT COUNT(*) FROM parkingsessions WHERE card_uid = $1 AND time_out IS NULL",
            [CARD_UID]
        );
        expect(parseInt(activeCount.rows[0].count, 10)).toBe(1);
    });
});
