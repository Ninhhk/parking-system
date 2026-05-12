const fs = require("fs");
const path = require("path");

const { pool } = require("../../config/db");

const loadRepo = () => {
    const repoPath = require.resolve("../../repositories/employee.sessions.repo");
    delete require.cache[repoPath];
    return require("../../repositories/employee.sessions.repo");
};

describe("closeSession", () => {
    let lotId;

    beforeAll(async () => {
        // Apply base schema and any required migrations
        const baseSchemaPath = path.resolve(__dirname, "../../../db/init/001_schema.sql");
        const hybridSchemaPath = path.resolve(__dirname, "../../../db/init/007_hybrid_edge_checkin_schema.sql");

        const baseSchemaSql = fs.readFileSync(baseSchemaPath, "utf8");
        await pool.query(baseSchemaSql);

        if (fs.existsSync(hybridSchemaPath)) {
            const hybridSchemaSql = fs.readFileSync(hybridSchemaPath, "utf8");
            await pool.query(hybridSchemaSql);
        } else {
            await pool.query("ALTER TABLE parkingsessions ADD COLUMN IF NOT EXISTS card_uid VARCHAR(50)");
            await pool.query("ALTER TABLE parkingsessions ADD COLUMN IF NOT EXISTS etag_epc VARCHAR(50)");
            await pool.query("ALTER TABLE parkingsessions ADD COLUMN IF NOT EXISTS entry_lane_id VARCHAR(50)");
            await pool.query("ALTER TABLE parkingsessions ADD COLUMN IF NOT EXISTS image_in_url VARCHAR(255)");
            await pool.query(
                "ALTER TABLE parkingsessions ADD COLUMN IF NOT EXISTS metadata_in JSONB NOT NULL DEFAULT '{}'::jsonb"
            );
        }

        // Create a shared lot for all tests
        const lotResult = await pool.query(
            `INSERT INTO parkinglots (lot_name, car_capacity, bike_capacity, current_car, current_bike)
             VALUES ($1, 50, 50, 0, 0)
             RETURNING lot_id`,
            [`lot_close_${Date.now()}`]
        );
        lotId = lotResult.rows[0].lot_id;
    });

    afterEach(async () => {
        await pool.query("DELETE FROM parkingsessions WHERE lot_id = $1", [lotId]);
        // Reset counts after each test
        await pool.query(
            "UPDATE parkinglots SET current_car = 0, current_bike = 0 WHERE lot_id = $1",
            [lotId]
        );
    });

    afterAll(async () => {
        await pool.query("DELETE FROM parkinglots WHERE lot_id = $1", [lotId]);
        await pool.end();
    });

    it("sets time_out and decrements current_car for a car session", async () => {
        const repo = loadRepo();

        // Seed: active car session with lot count = 1
        await pool.query(
            "UPDATE parkinglots SET current_car = 1 WHERE lot_id = $1",
            [lotId]
        );
        const inserted = await pool.query(
            `INSERT INTO parkingsessions
                (lot_id, license_plate, vehicle_type, time_in, is_monthly, parking_fee)
             VALUES ($1, $2, 'car', NOW() - INTERVAL '30 minutes', false, 0)
             RETURNING session_id`,
            [lotId, "51A-11111"]
        );
        const sessionId = inserted.rows[0].session_id;

        const closed = await repo.closeSession(sessionId);

        expect(closed).not.toBeNull();
        expect(closed.session_id).toBe(sessionId);
        expect(closed.time_out).not.toBeNull();

        // Lot count should have been decremented
        const lot = await pool.query(
            "SELECT current_car FROM parkinglots WHERE lot_id = $1",
            [lotId]
        );
        expect(lot.rows[0].current_car).toBe(0);
    });

    it("sets time_out and decrements current_bike for a bike session", async () => {
        const repo = loadRepo();

        await pool.query(
            "UPDATE parkinglots SET current_bike = 2 WHERE lot_id = $1",
            [lotId]
        );
        const inserted = await pool.query(
            `INSERT INTO parkingsessions
                (lot_id, license_plate, vehicle_type, time_in, is_monthly, parking_fee)
             VALUES ($1, $2, 'bike', NOW() - INTERVAL '15 minutes', false, 0)
             RETURNING session_id`,
            [lotId, "51A-22222"]
        );
        const sessionId = inserted.rows[0].session_id;

        const closed = await repo.closeSession(sessionId);

        expect(closed).not.toBeNull();
        expect(closed.time_out).not.toBeNull();

        const lot = await pool.query(
            "SELECT current_bike FROM parkinglots WHERE lot_id = $1",
            [lotId]
        );
        expect(lot.rows[0].current_bike).toBe(1);
    });

    it("returns null when session_id does not exist", async () => {
        const repo = loadRepo();

        const result = await repo.closeSession(999999999);

        expect(result).toBeNull();
    });

    it("returns null when session is already closed (idempotent)", async () => {
        const repo = loadRepo();

        const inserted = await pool.query(
            `INSERT INTO parkingsessions
                (lot_id, license_plate, vehicle_type, time_in, time_out, is_monthly, parking_fee)
             VALUES ($1, $2, 'car', NOW() - INTERVAL '60 minutes', NOW() - INTERVAL '10 minutes', false, 0)
             RETURNING session_id`,
            [lotId, "51A-33333"]
        );
        const sessionId = inserted.rows[0].session_id;

        const result = await repo.closeSession(sessionId);

        expect(result).toBeNull();
    });

    it("does not decrement lot count below 0 (GREATEST guard)", async () => {
        const repo = loadRepo();

        // current_car is already 0
        const inserted = await pool.query(
            `INSERT INTO parkingsessions
                (lot_id, license_plate, vehicle_type, time_in, is_monthly, parking_fee)
             VALUES ($1, $2, 'car', NOW() - INTERVAL '5 minutes', false, 0)
             RETURNING session_id`,
            [lotId, "51A-44444"]
        );
        const sessionId = inserted.rows[0].session_id;

        const closed = await repo.closeSession(sessionId);

        expect(closed).not.toBeNull();

        const lot = await pool.query(
            "SELECT current_car FROM parkinglots WHERE lot_id = $1",
            [lotId]
        );
        expect(lot.rows[0].current_car).toBe(0);
    });
});
