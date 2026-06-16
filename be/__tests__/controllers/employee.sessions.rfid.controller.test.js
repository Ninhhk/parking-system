const createResponse = () => ({
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
});

const loadControllerWithFlag = (rfidEnabled) => {
    jest.resetModules();
    jest.doMock("../../config/constants", () => ({
        RFID_CHECKIN_ENABLED: rfidEnabled,
        LICENSE_PLATE_REGEX: /^[A-Z0-9-]+$/i,
        VALID_PAYMENT_METHODS: ["CASH", "CARD"],
        VALID_VEHICLE_TYPES: ["car", "bike"],
    }));

    const sessionsRepo = {
        startSession: jest.fn(),
        checkMonthlySubByCard: jest.fn().mockResolvedValue(undefined),
    };

    const lotsRepo = {
        getParkingLotByManager: jest.fn(),
        getAllParkingLots: jest.fn(),
    };

    jest.doMock("../../repositories/employee.sessions.repo", () => sessionsRepo);
    jest.doMock("../../repositories/admin.lots.repo", () => lotsRepo);

    const parkingCardsRepo = {
        getPoolCard: jest.fn().mockResolvedValue(null),
        markLost: jest.fn(),
    };
    jest.doMock("../../repositories/parkingCards.repo", () => parkingCardsRepo);

    const controller = require("../../controllers/employee.sessions.controller");
    return { controller, sessionsRepo, lotsRepo, parkingCardsRepo };
};

describe("employee.sessions.controller checkInByRfid", () => {
    it("returns 503 when RFID_CHECKIN_ENABLED is false", async () => {
        const { controller, sessionsRepo, lotsRepo } = loadControllerWithFlag(false);
        const req = {
            body: {
                card_uid: "CARD-1001",
                vehicle_type: "car",
            },
            session: {
                user: { user_id: 11 },
            },
        };
        const res = createResponse();

        await controller.checkInByRfid(req, res);

        expect(res.status).toHaveBeenCalledWith(503);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            message: "RFID check-in is currently disabled",
        });
        expect(lotsRepo.getParkingLotByManager).not.toHaveBeenCalled();
        expect(sessionsRepo.startSession).not.toHaveBeenCalled();
    });

    it.each([
        [{ vehicle_type: "car" }, "missing card_uid"],
        [{ card_uid: "CARD-1001" }, "missing vehicle_type"],
    ])("returns 422 when required field is missing (%s)", async (bodyPayload) => {
        const { controller, sessionsRepo, lotsRepo } = loadControllerWithFlag(true);
        const req = {
            body: bodyPayload,
            session: {
                user: { user_id: 11 },
            },
        };
        const res = createResponse();

        await controller.checkInByRfid(req, res);

        expect(res.status).toHaveBeenCalledWith(422);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            message: "Missing required fields",
        });
        expect(lotsRepo.getParkingLotByManager).not.toHaveBeenCalled();
        expect(sessionsRepo.startSession).not.toHaveBeenCalled();
    });

    it("returns 422 when vehicle_type is invalid", async () => {
        const { controller, sessionsRepo, lotsRepo } = loadControllerWithFlag(true);
        const req = {
            body: {
                card_uid: "CARD-1002",
                vehicle_type: "truck",
            },
            session: {
                user: { user_id: 11 },
            },
        };
        const res = createResponse();

        await controller.checkInByRfid(req, res);

        expect(res.status).toHaveBeenCalledWith(422);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            message: "Invalid vehicle type",
        });
        expect(lotsRepo.getParkingLotByManager).not.toHaveBeenCalled();
        expect(sessionsRepo.startSession).not.toHaveBeenCalled();
    });

    it("returns 201 with ticket when payload is valid", async () => {
        const { controller, sessionsRepo, lotsRepo } = loadControllerWithFlag(true);
        const req = {
            body: {
                card_uid: "CARD-2001",
                etag_epc: "E200001B",
                vehicle_type: "car",
                entry_lane_id: "lane-a",
                image_in_url: "https://example.com/in.jpg",
                metadata_in: { source: "kiosk" },
            },
            session: {
                user: { user_id: 17 },
            },
        };
        const res = createResponse();

        lotsRepo.getParkingLotByManager.mockResolvedValue({ lot_id: 5, lot_name: "Assigned Lot" });
        sessionsRepo.startSession.mockResolvedValue({
            session_id: 999,
            license_plate: null,
            vehicle_type: "car",
            time_in: "2026-04-27T09:30:00.000Z",
            is_monthly: false,
            lot_id: 5,
        });

        await controller.checkInByRfid(req, res);

        expect(lotsRepo.getParkingLotByManager).toHaveBeenCalledWith(17);
        expect(sessionsRepo.startSession).toHaveBeenCalledWith({
            lot_id: 5,
            license_plate: null,
            vehicle_type: "car",
            is_monthly: false,
            card_uid: "CARD-2001",
            etag_epc: "E200001B",
            entry_lane_id: "lane-a",
            image_in_url: "https://example.com/in.jpg",
            metadata_in: { source: "kiosk" },
        });
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith({
            success: true,
            message: "Vehicle checked in successfully",
            ticket: {
                session_id: 999,
                license_plate: null,
                vehicle_type: "car",
                time_in: "2026-04-27T09:30:00.000Z",
                is_monthly: false,
                lot_id: 5,
                lot_name: "Assigned Lot",
            },
        });
    });

    it.each([
        ["uq_active_session_card_uid", { card_uid: "CARD-3001", vehicle_type: "car" }],
        [
            "uq_active_session_etag_epc",
            { card_uid: "CARD-3002", etag_epc: "EPC-3002", vehicle_type: "bike" },
        ],
    ])("returns 409 for %s", async (constraint, bodyPayload) => {
        const { controller, sessionsRepo, lotsRepo } = loadControllerWithFlag(true);
        const req = {
            body: bodyPayload,
            session: {
                user: { user_id: 23 },
            },
        };
        const res = createResponse();

        lotsRepo.getParkingLotByManager.mockResolvedValue({ lot_id: 8, lot_name: "Lot 8" });
        sessionsRepo.startSession.mockRejectedValue({
            code: "23505",
            constraint,
        });

        await controller.checkInByRfid(req, res);

        expect(res.status).toHaveBeenCalledWith(409);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            message: "This vehicle already has an active session",
        });
    });

    it("returns 404 when repository throws LOT_NOT_FOUND", async () => {
        const { controller, sessionsRepo, lotsRepo } = loadControllerWithFlag(true);
        const req = {
            body: {
                card_uid: "CARD-404",
                vehicle_type: "car",
            },
            session: {
                user: { user_id: 29 },
            },
        };
        const res = createResponse();

        lotsRepo.getParkingLotByManager.mockResolvedValue({ lot_id: 3, lot_name: "Lot 3" });
        sessionsRepo.startSession.mockRejectedValue({
            code: "LOT_NOT_FOUND",
            message: "Parking lot not found",
        });

        await controller.checkInByRfid(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            message: "Parking lot not found",
        });
    });

    it("returns 409 when lot capacity is full", async () => {
        const { controller, sessionsRepo, lotsRepo } = loadControllerWithFlag(true);
        const req = {
            body: {
                card_uid: "CARD-409",
                vehicle_type: "bike",
            },
            session: {
                user: { user_id: 41 },
            },
        };
        const res = createResponse();

        lotsRepo.getParkingLotByManager.mockResolvedValue({ lot_id: 2, lot_name: "Lot 2" });
        sessionsRepo.startSession.mockResolvedValue(null);

        await controller.checkInByRfid(req, res);

        expect(res.status).toHaveBeenCalledWith(409);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            message: "Parking lot is full for bikes",
        });
    });

    it("uses first lot when employee has no assigned lot", async () => {
        const { controller, sessionsRepo, lotsRepo } = loadControllerWithFlag(true);
        const req = {
            body: {
                card_uid: "CARD-LOT-FALLBACK",
                vehicle_type: "car",
            },
            session: {
                user: { user_id: 51 },
            },
        };
        const res = createResponse();

        lotsRepo.getParkingLotByManager.mockResolvedValue(null);
        lotsRepo.getAllParkingLots.mockResolvedValue([
            { lot_id: 9, lot_name: "Fallback Lot" },
            { lot_id: 10, lot_name: "Second Lot" },
        ]);
        sessionsRepo.startSession.mockResolvedValue({
            session_id: 1200,
            license_plate: null,
            vehicle_type: "car",
            time_in: "2026-04-27T10:00:00.000Z",
            is_monthly: false,
            lot_id: 9,
        });

        await controller.checkInByRfid(req, res);

        expect(lotsRepo.getParkingLotByManager).toHaveBeenCalledWith(51);
        expect(lotsRepo.getAllParkingLots).toHaveBeenCalledTimes(1);
        expect(sessionsRepo.startSession).toHaveBeenCalledWith(
            expect.objectContaining({
                lot_id: 9,
                card_uid: "CARD-LOT-FALLBACK",
                vehicle_type: "car",
            })
        );
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                success: true,
                ticket: expect.objectContaining({
                    lot_id: 9,
                    lot_name: "Fallback Lot",
                }),
            })
        );
    });

    it("returns 404 when no lot is available and does not start session", async () => {
        const { controller, sessionsRepo, lotsRepo } = loadControllerWithFlag(true);
        const req = {
            body: {
                card_uid: "CARD-NO-LOT",
                vehicle_type: "car",
            },
            session: {
                user: { user_id: 61 },
            },
        };
        const res = createResponse();

        lotsRepo.getParkingLotByManager.mockResolvedValue(null);
        lotsRepo.getAllParkingLots.mockResolvedValue([]);

        await controller.checkInByRfid(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            message: "No parking lots available",
        });
        expect(sessionsRepo.startSession).not.toHaveBeenCalled();
    });

    it("returns 500 for unknown errors", async () => {
        const { controller, sessionsRepo, lotsRepo } = loadControllerWithFlag(true);
        const req = {
            body: {
                card_uid: "CARD-500",
                vehicle_type: "car",
            },
            session: {
                user: { user_id: 31 },
            },
        };
        const res = createResponse();

        lotsRepo.getParkingLotByManager.mockResolvedValue({ lot_id: 1, lot_name: "Lot 1" });
        sessionsRepo.startSession.mockRejectedValue(new Error("db down"));

        await controller.checkInByRfid(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            message: "Internal server error",
        });
    });
});
