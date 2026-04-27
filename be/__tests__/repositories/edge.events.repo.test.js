const fs = require("fs");
const path = require("path");

const { pool } = require("../../config/db");
const edgeEventsRepo = require("../../repositories/edge.events.repo");

const loadEmployeeSessionsRepo = () => {
    const repoPath = require.resolve("../../repositories/employee.sessions.repo");
    delete require.cache[repoPath];
    return require("../../repositories/employee.sessions.repo");
};

describe("edge.events.repo", () => {
    let processingEvent1;
    let processingEvent2;
    let successEvent;

    beforeAll(async () => {
        const baseSchemaPath = path.resolve(__dirname, "../../../db/init/001_schema.sql");
        const hybridSchemaPath = path.resolve(__dirname, "../../../db/init/007_hybrid_edge_checkin_schema.sql");
        const migrationPath = path.resolve(__dirname, "../../../db/init/008_edge_events.sql");
        const baseSchemaSql = fs.readFileSync(baseSchemaPath, "utf8");
        const migrationSql = fs.readFileSync(migrationPath, "utf8");

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
        await pool.query(migrationSql);
    });

    afterEach(async () => {
        await pool.query("DELETE FROM edge_events");
        await pool.query("DELETE FROM parkingsessions");
        await pool.query("DELETE FROM parkinglots");
    });

    it("createProcessing stores row", async () => {
        const eventId = `evt_${Date.now()}_${Math.random().toString(16).slice(2)}`;

        const created = await edgeEventsRepo.createProcessing({
            eventId,
            gatewayId: "gw-a",
            laneId: "lane-a",
            triggerType: "card_uid",
            triggerValue: "card-123",
            occurredAt: new Date().toISOString(),
            payload: { source: "unit-test" },
        });

        expect(created).toBeTruthy();
        expect(created.event_id).toBe(eventId);
        expect(created.status).toBe("PROCESSING");
        expect(created.lane_id).toBe("lane-a");
        expect(created.payload_json.gatewayId).toBe("gw-a");
    });

    it("markSuccess sets status and session_id", async () => {
        const eventId = `evt_${Date.now()}_${Math.random().toString(16).slice(2)}`;
        const lot = await pool.query(
            `INSERT INTO parkinglots (lot_name, car_capacity, bike_capacity, current_car, current_bike)
             VALUES ($1, 100, 100, 0, 0)
             RETURNING lot_id`,
            [`lot_success_${Date.now()}`]
        );
        const session = await pool.query(
            `INSERT INTO parkingsessions
                (lot_id, license_plate, vehicle_type, time_in, is_monthly, parking_fee)
             VALUES ($1, $2, 'car', NOW(), false, 0)
             RETURNING session_id`,
            [lot.rows[0].lot_id, "51A90001"]
        );

        await edgeEventsRepo.createProcessing({
            eventId,
            gatewayId: "gw-a",
            laneId: "lane-a",
            triggerType: "plate",
            triggerValue: "51A12345",
            occurredAt: new Date().toISOString(),
            payload: { source: "unit-test" },
        });

        const updated = await edgeEventsRepo.markSuccess({ eventId, sessionId: session.rows[0].session_id });

        expect(updated).toBeTruthy();
        expect(updated.status).toBe("SUCCESS");
        expect(updated.session_id).toBe(session.rows[0].session_id);
    });

    it("markFailed sets status and error fields", async () => {
        const eventId = `evt_${Date.now()}_${Math.random().toString(16).slice(2)}`;

        await edgeEventsRepo.createProcessing({
            eventId,
            gatewayId: "gw-a",
            laneId: "lane-a",
            triggerType: "etag_epc",
            triggerValue: "E200ABC",
            occurredAt: new Date().toISOString(),
            payload: { source: "unit-test" },
        });

        const updated = await edgeEventsRepo.markFailed({
            eventId,
            errorCode: "UNMATCHED",
            errorMessage: "Cannot match to active session",
        });

        expect(updated).toBeTruthy();
        expect(updated.status).toBe("FAILED");
        expect(updated.failure_reason).toContain("UNMATCHED");
        expect(updated.failure_reason).toContain("Cannot match to active session");
    });

    it("listEvents filters by status", async () => {
        processingEvent1 = `evt_${Date.now()}_p1`;
        processingEvent2 = `evt_${Date.now()}_p2`;
        successEvent = `evt_${Date.now()}_s1`;

        await edgeEventsRepo.createProcessing({
            eventId: processingEvent1,
            gatewayId: "gw-a",
            laneId: "lane-a",
            triggerType: "plate",
            triggerValue: "51A10001",
            occurredAt: new Date().toISOString(),
            payload: { source: "unit-test" },
        });
        await edgeEventsRepo.createProcessing({
            eventId: processingEvent2,
            gatewayId: "gw-a",
            laneId: "lane-a",
            triggerType: "plate",
            triggerValue: "51A10002",
            occurredAt: new Date().toISOString(),
            payload: { source: "unit-test" },
        });
        await edgeEventsRepo.createProcessing({
            eventId: successEvent,
            gatewayId: "gw-b",
            laneId: "lane-b",
            triggerType: "card_uid",
            triggerValue: "card-xyz",
            occurredAt: new Date().toISOString(),
            payload: { source: "unit-test" },
        });

        const lot = await pool.query(
            `INSERT INTO parkinglots (lot_name, car_capacity, bike_capacity, current_car, current_bike)
             VALUES ($1, 100, 100, 0, 0)
             RETURNING lot_id`,
            [`lot_filter_${Date.now()}`]
        );
        const session = await pool.query(
            `INSERT INTO parkingsessions
                (lot_id, license_plate, vehicle_type, time_in, is_monthly, parking_fee)
             VALUES ($1, $2, 'car', NOW(), false, 0)
             RETURNING session_id`,
            [lot.rows[0].lot_id, "51A90002"]
        );

        await edgeEventsRepo.markSuccess({ eventId: successEvent, sessionId: session.rows[0].session_id });

        const processingRows = await edgeEventsRepo.listEvents({ status: "PROCESSING", page: 1, pageSize: 20 });

        expect(processingRows.length).toBe(2);
        expect(processingRows.every((row) => row.status === "PROCESSING")).toBe(true);
    });

    it("listEvents accepts numeric-string pagination params", async () => {
        const now = new Date().toISOString();

        await edgeEventsRepo.createProcessing({
            eventId: `evt_${Date.now()}_n1`,
            gatewayId: "gw-a",
            laneId: "lane-a",
            triggerType: "plate",
            triggerValue: "51A20001",
            occurredAt: now,
            payload: { source: "unit-test" },
        });
        await edgeEventsRepo.createProcessing({
            eventId: `evt_${Date.now()}_n2`,
            gatewayId: "gw-a",
            laneId: "lane-a",
            triggerType: "plate",
            triggerValue: "51A20002",
            occurredAt: now,
            payload: { source: "unit-test" },
        });
        await edgeEventsRepo.createProcessing({
            eventId: `evt_${Date.now()}_n3`,
            gatewayId: "gw-a",
            laneId: "lane-a",
            triggerType: "plate",
            triggerValue: "51A20003",
            occurredAt: now,
            payload: { source: "unit-test" },
        });

        const rows = await edgeEventsRepo.listEvents({ page: "1", pageSize: "2" });

        expect(rows).toHaveLength(2);
    });

    it("findActiveByCardUid returns latest active session", async () => {
        const employeeSessionsRepo = loadEmployeeSessionsRepo();
        const lot = await pool.query(
            `INSERT INTO parkinglots (lot_name, car_capacity, bike_capacity, current_car, current_bike)
             VALUES ($1, 100, 100, 0, 0)
             RETURNING lot_id`,
            [`lot_card_${Date.now()}`]
        );
        const lotId = lot.rows[0].lot_id;

        await pool.query(
            `INSERT INTO parkingsessions
                (lot_id, license_plate, vehicle_type, time_in, time_out, is_monthly, parking_fee, card_uid)
             VALUES
                ($1, $2, 'car', NOW() - INTERVAL '5 minutes', NOW() - INTERVAL '1 minute', false, 0, $3),
                ($1, $4, 'car', NOW() - INTERVAL '2 minutes', NULL, false, 0, $3)`,
            [lotId, "51A30001", "card-abc", "51A30002"]
        );

        const session = await employeeSessionsRepo.findActiveByCardUid("card-abc");

        expect(session).toBeTruthy();
        expect(session.license_plate).toBe("51A30002");
    });

    it("findActiveByEtagEpc returns latest active session", async () => {
        const employeeSessionsRepo = loadEmployeeSessionsRepo();
        const lot = await pool.query(
            `INSERT INTO parkinglots (lot_name, car_capacity, bike_capacity, current_car, current_bike)
             VALUES ($1, 100, 100, 0, 0)
             RETURNING lot_id`,
            [`lot_etag_${Date.now()}`]
        );
        const lotId = lot.rows[0].lot_id;

        await pool.query(
            `INSERT INTO parkingsessions
                (lot_id, license_plate, vehicle_type, time_in, time_out, is_monthly, parking_fee, etag_epc)
             VALUES
                ($1, $2, 'car', NOW() - INTERVAL '4 minutes', NOW() - INTERVAL '1 minute', false, 0, $3),
                ($1, $4, 'car', NOW() - INTERVAL '1 minutes', NULL, false, 0, $3)`,
            [lotId, "51A31001", "E200ABC", "51A31002"]
        );

        const session = await employeeSessionsRepo.findActiveByEtagEpc("E200ABC");

        expect(session).toBeTruthy();
        expect(session.license_plate).toBe("51A31002");
    });

    it("findActiveByPlate returns latest active session", async () => {
        const employeeSessionsRepo = loadEmployeeSessionsRepo();
        const lot = await pool.query(
            `INSERT INTO parkinglots (lot_name, car_capacity, bike_capacity, current_car, current_bike)
             VALUES ($1, 100, 100, 0, 0)
             RETURNING lot_id`,
            [`lot_plate_${Date.now()}`]
        );
        const lotId = lot.rows[0].lot_id;

        await pool.query(
            `INSERT INTO parkingsessions
                (lot_id, license_plate, vehicle_type, time_in, time_out, is_monthly, parking_fee)
             VALUES
                ($1, $2, 'car', NOW() - INTERVAL '5 minutes', NOW() - INTERVAL '1 minute', false, 0),
                ($1, $2, 'car', NOW() - INTERVAL '30 seconds', NULL, false, 0)`,
            [lotId, "51A32001"]
        );

        const session = await employeeSessionsRepo.findActiveByPlate("51A32001");

        expect(session).toBeTruthy();
        expect(session.time_out).toBeNull();
    });

    it("enrichRecentSessionByLane returns null when entry_lane_id column is unavailable", async () => {
        const lot = await pool.query(
            `INSERT INTO parkinglots (lot_name, car_capacity, bike_capacity, current_car, current_bike)
             VALUES ($1, 100, 100, 0, 0)
             RETURNING lot_id`,
            [`lot_guard_${Date.now()}`]
        );
        const lotId = lot.rows[0].lot_id;

        const inserted = await pool.query(
            `INSERT INTO parkingsessions
                (lot_id, license_plate, vehicle_type, time_in, is_monthly, parking_fee, image_in_url)
             VALUES
                ($1, $2, 'car', NOW() - INTERVAL '45 seconds', false, 0, NULL)
             RETURNING session_id`,
            [lotId, "51A33001"]
        );

        await pool.query("ALTER TABLE parkingsessions DROP COLUMN IF EXISTS entry_lane_id");

        try {
            const employeeSessionsRepo = loadEmployeeSessionsRepo();
            const result = await employeeSessionsRepo.enrichRecentSessionByLane({
                laneId: "lane-missing",
                plate: "51A33001",
                imageInUrl: "http://image/new.jpg",
                windowSeconds: 120,
            });

            const verify = await pool.query(
                `SELECT image_in_url FROM parkingsessions WHERE session_id = $1`,
                [inserted.rows[0].session_id]
            );

            expect(result).toBeNull();
            expect(verify.rows[0].image_in_url).toBeNull();
        } finally {
            await pool.query("ALTER TABLE parkingsessions ADD COLUMN IF NOT EXISTS entry_lane_id VARCHAR(50)");
        }
    });

    it("enforces unique event_id", async () => {
        const eventId = `evt_${Date.now()}_${Math.random().toString(16).slice(2)}`;

        try {
            await pool.query(
                `
                    INSERT INTO edge_events (event_id, lane_id, occurred_at, status, payload_json)
                    VALUES ($1, $2, NOW(), $3, $4::jsonb)
                `,
                [eventId, "lane-a", "PROCESSING", JSON.stringify({ source: "test" })]
            );

            await expect(
                pool.query(
                    `
                        INSERT INTO edge_events (event_id, lane_id, occurred_at, status, payload_json)
                        VALUES ($1, $2, NOW(), $3, $4::jsonb)
                    `,
                    [eventId, "lane-a", "PROCESSING", JSON.stringify({ source: "duplicate" })]
                )
            ).rejects.toMatchObject({ code: "23505" });
        } finally {
            await pool.query("DELETE FROM edge_events WHERE event_id = $1", [eventId]);
        }
    });
});
