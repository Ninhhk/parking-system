// Integration test for the parking_cards repository CRUD round-trip.
// Exercises the REAL repo functions against Docker Postgres (no mocks):
//   create (lot-bound + shared) -> list/inventory -> setStatus -> delete.
//
// Inventory is asserted as deltas against a baseline snapshot so the test is
// robust to any pre-existing pool cards (015 seed rows, leftovers from other
// suites). All rows this test inserts use the IT-CRUD- prefix and are removed
// in afterAll, so nothing leaks into the live tables.
//
// Requires Docker Postgres on port 55432; run with --runInBand --forceExit:
//   DB_HOST=localhost DB_PORT=55432 DB_USER=admin DB_PASSWORD=password123 \
//     DB_NAME=parking_lot npx jest parkingCards.repo.integration --runInBand --forceExit
//
// Validates: Requirements 2.1, 2.2, 4.1, 4.2, 5.1

const { pool } = require("../../config/db");
const parkingCardsRepo = require("../../repositories/parkingCards.repo");

const UID_PREFIX = "IT-CRUD-";
const LOT_UID = `${UID_PREFIX}LOT-${Date.now()}`;
const SHARED_UID = `${UID_PREFIX}SHARED-${Date.now()}`;

describe("parkingCards.repo CRUD round-trip (integration)", () => {
    let testLotId;
    let testLotName;
    let baseline;

    beforeAll(async () => {
        // Self-contained lot for the lot-bound card (managed_by is nullable).
        testLotName = `IT CRUD Lot ${Date.now()}`;
        const lotRes = await pool.query(
            `INSERT INTO parkinglots (lot_name, car_capacity, bike_capacity, managed_by)
             VALUES ($1, $2, $3, NULL)
             RETURNING lot_id`,
            [testLotName, 10, 10]
        );
        testLotId = lotRes.rows[0].lot_id;

        // Clear any leftovers from a prior interrupted run, then snapshot inventory.
        await pool.query("DELETE FROM parking_cards WHERE card_uid LIKE $1", [`${UID_PREFIX}%`]);
        baseline = await parkingCardsRepo.getInventoryCounts();
    });

    afterAll(async () => {
        await pool.query("DELETE FROM parking_cards WHERE card_uid LIKE $1", [`${UID_PREFIX}%`]);
        await pool.query("DELETE FROM parkinglots WHERE lot_id = $1", [testLotId]);
        await pool.end();
    });

    test("create -> list/inventory -> setStatus -> delete", async () => {
        // --- create: lot-bound (Req 2.1) and shared (Req 2.2) ---
        const lotCard = await parkingCardsRepo.insertPoolCard(LOT_UID, testLotId);
        expect(lotCard).toMatchObject({ card_uid: LOT_UID, lot_id: testLotId, status: "available" });
        expect(lotCard.created_at).toBeInstanceOf(Date);

        const sharedCard = await parkingCardsRepo.insertPoolCard(SHARED_UID, null);
        expect(sharedCard).toMatchObject({ card_uid: SHARED_UID, lot_id: null, status: "available" });

        // --- list: both appear; lot_name resolved for lot-bound, null for shared ---
        const listed = await parkingCardsRepo.listPoolCards(UID_PREFIX);
        expect(listed).toHaveLength(2);
        const byUid = Object.fromEntries(listed.map((c) => [c.card_uid, c]));
        expect(byUid[LOT_UID]).toMatchObject({ lot_id: testLotId, lot_name: testLotName, status: "available" });
        expect(byUid[SHARED_UID]).toMatchObject({ lot_id: null, lot_name: null, status: "available" });

        // --- inventory: two new available cards over baseline (Req 5.1) ---
        let inv = await parkingCardsRepo.getInventoryCounts();
        expect(inv.total).toBe(baseline.total + 2);
        expect(inv.available).toBe(baseline.available + 2);
        expect(inv.lost).toBe(baseline.lost);

        // --- setStatus: available -> lost (Req 4.1); inventory follows ---
        const lost = await parkingCardsRepo.setStatus(LOT_UID, "lost");
        expect(lost).toMatchObject({ card_uid: LOT_UID, status: "lost" });

        inv = await parkingCardsRepo.getInventoryCounts();
        expect(inv.total).toBe(baseline.total + 2);
        expect(inv.available).toBe(baseline.available + 1);
        expect(inv.lost).toBe(baseline.lost + 1);

        // --- setStatus: lost -> available (Req 4.2); inventory follows ---
        const reactivated = await parkingCardsRepo.setStatus(LOT_UID, "available");
        expect(reactivated).toMatchObject({ card_uid: LOT_UID, status: "available" });

        inv = await parkingCardsRepo.getInventoryCounts();
        expect(inv.available).toBe(baseline.available + 2);
        expect(inv.lost).toBe(baseline.lost);

        // setStatus on a missing card matches no row -> null
        expect(await parkingCardsRepo.setStatus(`${UID_PREFIX}NOPE`, "lost")).toBeNull();

        // --- delete: removes both, returning the deleted row ---
        expect(await parkingCardsRepo.deletePoolCard(LOT_UID)).toMatchObject({ card_uid: LOT_UID });
        expect(await parkingCardsRepo.deletePoolCard(SHARED_UID)).toMatchObject({ card_uid: SHARED_UID });

        // deleting a now-missing card -> null
        expect(await parkingCardsRepo.deletePoolCard(LOT_UID)).toBeNull();

        // --- inventory back to baseline after the round-trip ---
        expect(await parkingCardsRepo.getInventoryCounts()).toEqual(baseline);
    });
});
