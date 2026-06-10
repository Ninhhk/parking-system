/**
 * Unit tests for admin.parkingCards.controller (service mocked).
 *
 * Covers the thin-controller contract for the Card Pool API:
 *  - createCard rejects a malformed UID with 422 without calling the service (Req 2.3),
 *    rejects a malformed lot_id with 422, and returns 201 with { success, data } on success
 *    (Req 2.1)
 *  - setStatus rejects a bad status enum and a bad UID path param with 422 (Req 4.3)
 *  - service errors carrying err.statusCode (404/409) propagate to the matching HTTP status
 *    with the { success: false, message } envelope (Req 3.1)
 *  - listCards / getInventory return 200 with { success, data } (Req 1.2, 5.1)
 *
 * Validates: Requirements 1.2, 2.1, 2.3, 3.1, 4.3, 5.1
 */

jest.mock("../../services/admin.parkingCards.service", () => ({
    listCards: jest.fn(),
    getInventory: jest.fn(),
    createCard: jest.fn(),
    setStatus: jest.fn(),
    deleteCard: jest.fn(),
}));

const parkingCardsService = require("../../services/admin.parkingCards.service");
const controller = require("../../controllers/admin.parkingCards.controller");

const createResponse = () => ({
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
});

// A domain error as thrown by the service via createError(statusCode, message).
const serviceError = (statusCode, message) => {
    const err = new Error(message);
    err.statusCode = statusCode;
    return err;
};

describe("admin.parkingCards.controller", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("listCards", () => {
        it("returns 200 with the { success, data } envelope (Req 1.2)", async () => {
            const cards = [{ card_uid: "POOL-001", lot_id: 1, status: "available" }];
            parkingCardsService.listCards.mockResolvedValue(cards);

            const req = { query: { q: "POOL" } };
            const res = createResponse();

            await controller.listCards(req, res);

            expect(parkingCardsService.listCards).toHaveBeenCalledWith("POOL");
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith({ success: true, data: cards });
        });

        it("passes undefined to the service when q is absent", async () => {
            parkingCardsService.listCards.mockResolvedValue([]);

            const req = { query: {} };
            const res = createResponse();

            await controller.listCards(req, res);

            expect(parkingCardsService.listCards).toHaveBeenCalledWith(undefined);
            expect(res.status).toHaveBeenCalledWith(200);
        });

        it("propagates an unexpected service error as 500 without leaking the message", async () => {
            parkingCardsService.listCards.mockRejectedValue(new Error("db down"));

            const req = { query: {} };
            const res = createResponse();

            await controller.listCards(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                message: "Internal server error",
            });
        });
    });

    describe("getInventory", () => {
        it("returns 200 with the inventory counts in { success, data } (Req 5.1)", async () => {
            const inventory = { total: 3, available: 2, lost: 1 };
            parkingCardsService.getInventory.mockResolvedValue(inventory);

            const req = {};
            const res = createResponse();

            await controller.getInventory(req, res);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith({ success: true, data: inventory });
        });
    });

    describe("createCard", () => {
        it("returns 201 with the created card in { success, data } on success (Req 2.1)", async () => {
            const created = { card_uid: "POOL-001", lot_id: 1, status: "available" };
            parkingCardsService.createCard.mockResolvedValue(created);

            const req = { body: { card_uid: "POOL-001", lot_id: 1 } };
            const res = createResponse();

            await controller.createCard(req, res);

            expect(parkingCardsService.createCard).toHaveBeenCalledWith({
                card_uid: "POOL-001",
                lot_id: 1,
            });
            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.json).toHaveBeenCalledWith({ success: true, data: created });
        });

        it("creates a shared card (lot_id null) when lot_id is absent", async () => {
            const created = { card_uid: "SHARED-1", lot_id: null, status: "available" };
            parkingCardsService.createCard.mockResolvedValue(created);

            const req = { body: { card_uid: "SHARED-1" } };
            const res = createResponse();

            await controller.createCard(req, res);

            expect(parkingCardsService.createCard).toHaveBeenCalledWith({
                card_uid: "SHARED-1",
                lot_id: null,
            });
            expect(res.status).toHaveBeenCalledWith(201);
        });

        it("rejects a malformed card_uid with 422 and does not call the service (Req 2.3)", async () => {
            const req = { body: { card_uid: "bad uid!", lot_id: 1 } };
            const res = createResponse();

            await controller.createCard(req, res);

            expect(res.status).toHaveBeenCalledWith(422);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                message: "Invalid card UID",
            });
            expect(parkingCardsService.createCard).not.toHaveBeenCalled();
        });

        it("rejects a missing card_uid with 422 and does not call the service (Req 2.3)", async () => {
            const req = { body: { lot_id: 1 } };
            const res = createResponse();

            await controller.createCard(req, res);

            expect(res.status).toHaveBeenCalledWith(422);
            expect(parkingCardsService.createCard).not.toHaveBeenCalled();
        });

        it("rejects a non-positive-integer lot_id with 422 and does not call the service", async () => {
            const req = { body: { card_uid: "POOL-001", lot_id: -5 } };
            const res = createResponse();

            await controller.createCard(req, res);

            expect(res.status).toHaveBeenCalledWith(422);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                message: "lot_id must be a positive integer or null",
            });
            expect(parkingCardsService.createCard).not.toHaveBeenCalled();
        });

        it("maps a service 422 (duplicate card) to a 422 envelope (Req 2.4)", async () => {
            parkingCardsService.createCard.mockRejectedValue(
                serviceError(422, "Card already exists")
            );

            const req = { body: { card_uid: "POOL-001", lot_id: 1 } };
            const res = createResponse();

            await controller.createCard(req, res);

            expect(res.status).toHaveBeenCalledWith(422);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                message: "Card already exists",
            });
        });
    });

    describe("setStatus", () => {
        it("returns 200 with the updated card in { success, data } on success (Req 4.1)", async () => {
            const updated = { card_uid: "POOL-001", lot_id: 1, status: "lost" };
            parkingCardsService.setStatus.mockResolvedValue(updated);

            const req = { params: { card_uid: "POOL-001" }, body: { status: "lost" } };
            const res = createResponse();

            await controller.setStatus(req, res);

            expect(parkingCardsService.setStatus).toHaveBeenCalledWith("POOL-001", "lost");
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith({ success: true, data: updated });
        });

        it("rejects an invalid status enum with 422 and does not call the service (Req 4.3)", async () => {
            const req = { params: { card_uid: "POOL-001" }, body: { status: "broken" } };
            const res = createResponse();

            await controller.setStatus(req, res);

            expect(res.status).toHaveBeenCalledWith(422);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                message: "status must be 'available' or 'lost'",
            });
            expect(parkingCardsService.setStatus).not.toHaveBeenCalled();
        });

        it("rejects a malformed card_uid path param with 422 and does not call the service", async () => {
            const req = { params: { card_uid: "bad uid!" }, body: { status: "lost" } };
            const res = createResponse();

            await controller.setStatus(req, res);

            expect(res.status).toHaveBeenCalledWith(422);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                message: "Invalid card UID",
            });
            expect(parkingCardsService.setStatus).not.toHaveBeenCalled();
        });

        it("propagates a service 404 (card not found) to a 404 envelope (Req 4.4)", async () => {
            parkingCardsService.setStatus.mockRejectedValue(
                serviceError(404, "Card not found")
            );

            const req = { params: { card_uid: "MISSING-UID" }, body: { status: "lost" } };
            const res = createResponse();

            await controller.setStatus(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                message: "Card not found",
            });
        });
    });

    describe("deleteCard", () => {
        it("returns 200 with the deleted card in { success, data } on success (Req 3.1)", async () => {
            const deleted = { card_uid: "POOL-001", lot_id: null, status: "available" };
            parkingCardsService.deleteCard.mockResolvedValue(deleted);

            const req = { params: { card_uid: "POOL-001" } };
            const res = createResponse();

            await controller.deleteCard(req, res);

            expect(parkingCardsService.deleteCard).toHaveBeenCalledWith("POOL-001");
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith({ success: true, data: deleted });
        });

        it("rejects a malformed card_uid path param with 422 and does not call the service", async () => {
            const req = { params: { card_uid: "bad uid!" } };
            const res = createResponse();

            await controller.deleteCard(req, res);

            expect(res.status).toHaveBeenCalledWith(422);
            expect(parkingCardsService.deleteCard).not.toHaveBeenCalled();
        });

        it("propagates a service 404 (card not found) to a 404 envelope (Req 3.2)", async () => {
            parkingCardsService.deleteCard.mockRejectedValue(
                serviceError(404, "Card not found")
            );

            const req = { params: { card_uid: "MISSING-UID" } };
            const res = createResponse();

            await controller.deleteCard(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                message: "Card not found",
            });
        });

        it("propagates a service 409 (card in use) to a 409 envelope (Req 3.3)", async () => {
            parkingCardsService.deleteCard.mockRejectedValue(
                serviceError(409, "Card is in use and cannot be deleted")
            );

            const req = { params: { card_uid: "POOL-001" } };
            const res = createResponse();

            await controller.deleteCard(req, res);

            expect(res.status).toHaveBeenCalledWith(409);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                message: "Card is in use and cannot be deleted",
            });
        });
    });
});
