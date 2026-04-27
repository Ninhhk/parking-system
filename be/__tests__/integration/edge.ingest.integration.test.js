const fs = require("fs");
const path = require("path");
const request = require("supertest");
const { pool } = require("../../config/db");

const edgeApiKey = "test-edge-key";
process.env.EDGE_INGEST_API_KEY = edgeApiKey;
process.env.SESSION_SECRET = "test-session-secret";

const app = require("../../app");

describe("edge ingest integration", () => {
    beforeAll(async () => {
        const baseSchemaPath = path.resolve(__dirname, "../../../db/init/001_schema.sql");
        const migrationPath = path.resolve(__dirname, "../../../db/init/008_edge_events.sql");
        const baseSchemaSql = fs.readFileSync(baseSchemaPath, "utf8");
        const migrationSql = fs.readFileSync(migrationPath, "utf8");

        await pool.query(baseSchemaSql);
        await pool.query(migrationSql);
    });

    afterEach(async () => {
        await pool.query("DELETE FROM edge_events");
        await pool.query("DELETE FROM parkingsessions");
        await pool.query("DELETE FROM parkinglots");
    });

    afterAll(async () => {
        await pool.end();
    });

    it("returns 201 for a newly processed edge ingest event", async () => {
        const lotResult = await pool.query(
            `INSERT INTO parkinglots (lot_name, car_capacity, bike_capacity, current_car, current_bike)
             VALUES ($1, 100, 100, 0, 0)
             RETURNING lot_id`,
            [`edge_lot_create_${Date.now()}`]
        );

        const payload = {
            event_id: `evt_create_${Date.now()}`,
            gateway_id: "gw-edge-a",
            lane_id: "lane-a",
            occurred_at: new Date().toISOString(),
            lot_id: lotResult.rows[0].lot_id,
            vehicle_type: "car",
            trigger: {
                type: "MANUAL",
                value: "51G-394.66",
            },
        };

        const response = await request(app)
            .post("/api/edge/events/ingest")
            .set("x-edge-api-key", edgeApiKey)
            .send(payload);

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toEqual(
            expect.objectContaining({
                duplicate: false,
                action: "SESSION_RESOLVED",
                session_id: expect.any(Number),
                event_id: payload.event_id,
            })
        );
    });

    it("returns 200 duplicate response when event_id already processed", async () => {
        const lotResult = await pool.query(
            `INSERT INTO parkinglots (lot_name, car_capacity, bike_capacity, current_car, current_bike)
             VALUES ($1, 100, 100, 0, 0)
             RETURNING lot_id`,
            [`edge_lot_duplicate_${Date.now()}`]
        );

        const payload = {
            event_id: `evt_dup_${Date.now()}`,
            gateway_id: "gw-edge-a",
            lane_id: "lane-a",
            occurred_at: new Date().toISOString(),
            lot_id: lotResult.rows[0].lot_id,
            vehicle_type: "car",
            trigger: {
                type: "MANUAL",
                value: "51A-12345",
            },
        };

        const first = await request(app)
            .post("/api/edge/events/ingest")
            .set("x-edge-api-key", edgeApiKey)
            .send(payload);
        const second = await request(app)
            .post("/api/edge/events/ingest")
            .set("x-edge-api-key", edgeApiKey)
            .send(payload);

        expect(first.status).toBe(201);
        expect(second.status).toBe(200);
        expect(second.body.success).toBe(true);
        expect(second.body.data).toEqual(
            expect.objectContaining({
                duplicate: true,
                action: "DUPLICATE",
                event_id: payload.event_id,
            })
        );
    });

    it("returns non-success envelope when LPD event cannot be correlated", async () => {
        const lotResult = await pool.query(
            `INSERT INTO parkinglots (lot_name, car_capacity, bike_capacity, current_car, current_bike)
             VALUES ($1, 100, 100, 0, 0)
             RETURNING lot_id`,
            [`edge_lot_lpd_unmatched_${Date.now()}`]
        );

        const payload = {
            event_id: `evt_lpd_unmatched_${Date.now()}`,
            gateway_id: "gw-edge-a",
            lane_id: "lane-lpd-a",
            occurred_at: new Date().toISOString(),
            lot_id: lotResult.rows[0].lot_id,
            vehicle_type: "car",
            trigger: {
                type: "LPD",
                plate: "51G39466",
            },
        };

        const response = await request(app)
            .post("/api/edge/events/ingest")
            .set("x-edge-api-key", edgeApiKey)
            .send(payload);

        expect(response.status).toBe(422);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe("LPD_UNMATCHED");
        expect(response.body.data).toEqual(
            expect.objectContaining({
                duplicate: false,
                status: "FAILED",
                action: "LPD_UNMATCHED",
                session_id: null,
                event_id: payload.event_id,
            })
        );
    });

    it("LPD event enriches recent active session", async () => {
        const lotResult = await pool.query(
            `INSERT INTO parkinglots (lot_name, car_capacity, bike_capacity, current_car, current_bike)
             VALUES ($1, 100, 100, 0, 0)
             RETURNING lot_id`,
            [`edge_lot_lpd_enrich_${Date.now()}`]
        );

        const icCardPayload = {
            event_id: `evt_ic_open_${Date.now()}`,
            gateway_id: "gw-edge-a",
            lane_id: "lane-enrich-a",
            occurred_at: new Date().toISOString(),
            lot_id: lotResult.rows[0].lot_id,
            vehicle_type: "car",
            trigger: {
                type: "IC_CARD",
                value: "CARD-ENRICH-001",
                plate: "51G39466",
            },
        };

        const icCardResponse = await request(app)
            .post("/api/edge/events/ingest")
            .set("x-edge-api-key", edgeApiKey)
            .send(icCardPayload);

        expect(icCardResponse.status).toBe(201);
        expect(icCardResponse.body.success).toBe(true);
        expect(icCardResponse.body.data).toEqual(
            expect.objectContaining({
                duplicate: false,
                action: "SESSION_RESOLVED",
                session_id: expect.any(Number),
                event_id: icCardPayload.event_id,
            })
        );

        const lpdPayload = {
            event_id: `evt_lpd_enrich_${Date.now()}`,
            gateway_id: "gw-edge-a",
            lane_id: icCardPayload.lane_id,
            occurred_at: new Date().toISOString(),
            lot_id: lotResult.rows[0].lot_id,
            vehicle_type: "car",
            trigger: {
                type: "LPD",
                plate: "51G39466",
            },
        };

        const lpdResponse = await request(app)
            .post("/api/edge/events/ingest")
            .set("x-edge-api-key", edgeApiKey)
            .send(lpdPayload);

        expect(lpdResponse.status).toBe(201);
        expect(lpdResponse.body.success).toBe(true);
        expect(lpdResponse.body.data).toEqual(
            expect.objectContaining({
                duplicate: false,
                action: "SESSION_RESOLVED",
                session_id: icCardResponse.body.data.session_id,
                event_id: lpdPayload.event_id,
            })
        );
    });

    it("returns 422 when required fields are missing", async () => {
        const response = await request(app)
            .post("/api/edge/events/ingest")
            .set("x-edge-api-key", edgeApiKey)
            .send({
                event_id: "evt_invalid_001",
                gateway_id: "gw-edge-a",
                lane_id: "lane-a",
                occurred_at: new Date().toISOString(),
                lot_id: 1,
                vehicle_type: "car",
                trigger: {},
            });

        expect(response.status).toBe(422);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toMatch(/required/i);
    });

    it("returns 422 when MANUAL trigger.value is missing", async () => {
        const response = await request(app)
            .post("/api/edge/events/ingest")
            .set("x-edge-api-key", edgeApiKey)
            .send({
                event_id: `evt_manual_missing_value_${Date.now()}`,
                gateway_id: "gw-edge-a",
                lane_id: "lane-a",
                occurred_at: new Date().toISOString(),
                lot_id: 1,
                vehicle_type: "car",
                trigger: {
                    type: "MANUAL",
                    value: "   ",
                },
            });

        expect(response.status).toBe(422);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe("trigger.value is required for MANUAL");
    });

    it("returns 422 when IC_CARD trigger.value is missing", async () => {
        const response = await request(app)
            .post("/api/edge/events/ingest")
            .set("x-edge-api-key", edgeApiKey)
            .send({
                event_id: `evt_ic_missing_value_${Date.now()}`,
                gateway_id: "gw-edge-a",
                lane_id: "lane-a",
                occurred_at: new Date().toISOString(),
                lot_id: 1,
                vehicle_type: "car",
                trigger: {
                    type: "IC_CARD",
                    value: "",
                },
            });

        expect(response.status).toBe(422);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe("trigger.value is required for IC_CARD");
    });

    it("returns 422 when UHF_TAG trigger.value is missing", async () => {
        const response = await request(app)
            .post("/api/edge/events/ingest")
            .set("x-edge-api-key", edgeApiKey)
            .send({
                event_id: `evt_uhf_missing_value_${Date.now()}`,
                gateway_id: "gw-edge-a",
                lane_id: "lane-a",
                occurred_at: new Date().toISOString(),
                lot_id: 1,
                vehicle_type: "car",
                trigger: {
                    type: "UHF_TAG",
                    value: " ",
                },
            });

        expect(response.status).toBe(422);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe("trigger.value is required for UHF_TAG");
    });

    it("returns 422 when LPD has neither trigger.value nor trigger.plate", async () => {
        const response = await request(app)
            .post("/api/edge/events/ingest")
            .set("x-edge-api-key", edgeApiKey)
            .send({
                event_id: `evt_lpd_missing_identity_${Date.now()}`,
                gateway_id: "gw-edge-a",
                lane_id: "lane-a",
                occurred_at: new Date().toISOString(),
                lot_id: 1,
                vehicle_type: "car",
                trigger: {
                    type: "LPD",
                },
            });

        expect(response.status).toBe(422);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe("LPD trigger requires trigger.value or trigger.plate");
    });

    it("returns 422 when trigger.type is not allowlisted", async () => {
        const response = await request(app)
            .post("/api/edge/events/ingest")
            .set("x-edge-api-key", edgeApiKey)
            .send({
                event_id: `evt_unknown_trigger_${Date.now()}`,
                gateway_id: "gw-edge-a",
                lane_id: "lane-a",
                occurred_at: new Date().toISOString(),
                lot_id: 1,
                vehicle_type: "car",
                trigger: {
                    type: "RFID",
                    value: "abc",
                },
            });

        expect(response.status).toBe(422);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe("trigger.type must be one of: LPD, MANUAL, IC_CARD, UHF_TAG");
    });

    it("returns 422 when vehicle_type is not allowlisted", async () => {
        const response = await request(app)
            .post("/api/edge/events/ingest")
            .set("x-edge-api-key", edgeApiKey)
            .send({
                event_id: `evt_invalid_vehicle_type_${Date.now()}`,
                gateway_id: "gw-edge-a",
                lane_id: "lane-a",
                occurred_at: new Date().toISOString(),
                lot_id: 1,
                vehicle_type: "truck",
                trigger: {
                    type: "MANUAL",
                    value: "51A12345",
                },
            });

        expect(response.status).toBe(422);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe("vehicle_type must be one of: car, bike");
    });

    it("returns 422 when occurred_at is invalid", async () => {
        const response = await request(app)
            .post("/api/edge/events/ingest")
            .set("x-edge-api-key", edgeApiKey)
            .send({
                event_id: `evt_invalid_occurred_at_${Date.now()}`,
                gateway_id: "gw-edge-a",
                lane_id: "lane-a",
                occurred_at: "not-a-date",
                lot_id: 1,
                vehicle_type: "car",
                trigger: {
                    type: "MANUAL",
                    value: "51A12345",
                },
            });

        expect(response.status).toBe(422);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe("occurred_at must be a valid datetime");
    });

    it("rejects ingest when x-edge-api-key is invalid", async () => {
        const response = await request(app)
            .post("/api/edge/events/ingest")
            .set("x-edge-api-key", "invalid-key")
            .send({
                event_id: "evt_unauthorized_001",
                gateway_id: "gw-edge-a",
                lane_id: "lane-a",
                occurred_at: new Date().toISOString(),
                lot_id: 1,
                vehicle_type: "car",
                trigger: {
                    type: "MANUAL",
                    value: "51A12345",
                },
            });

        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
    });
});
