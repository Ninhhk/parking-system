jest.mock("../../repositories/parkingCards.repo", () => ({
    listPoolCards: jest.fn(),
    getInventoryCounts: jest.fn(),
    insertPoolCard: jest.fn(),
    setStatus: jest.fn(),
    deletePoolCard: jest.fn(),
    hasActiveSession: jest.fn(),
}));

const parkingCardsService = require("../../services/admin.parkingCards.service");
const parkingCardsRepo = require("../../repositories/parkingCards.repo");

describe("admin parking cards service", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("createCard error mapping", () => {
        it("maps unique violation 23505 to a 422 'Card already exists' error (Req 2.4)", async () => {
            const dbErr = new Error("duplicate key value violates unique constraint");
            dbErr.code = "23505";
            parkingCardsRepo.insertPoolCard.mockRejectedValue(dbErr);

            await expect(
                parkingCardsService.createCard({ card_uid: "POOL-001", lot_id: 1 })
            ).rejects.toMatchObject({ statusCode: 422, message: "Card already exists" });
        });

        it("maps foreign-key violation 23503 to a 422 error (FK)", async () => {
            const dbErr = new Error("insert or update violates foreign key constraint");
            dbErr.code = "23503";
            parkingCardsRepo.insertPoolCard.mockRejectedValue(dbErr);

            await expect(
                parkingCardsService.createCard({ card_uid: "POOL-002", lot_id: 999 })
            ).rejects.toMatchObject({ statusCode: 422 });
        });

        it("re-throws unexpected repo errors without attaching a statusCode", async () => {
            const dbErr = new Error("connection terminated");
            dbErr.code = "08006";
            parkingCardsRepo.insertPoolCard.mockRejectedValue(dbErr);

            const thrown = await parkingCardsService
                .createCard({ card_uid: "POOL-003", lot_id: 1 })
                .catch((err) => err);

            expect(thrown).toBe(dbErr);
            expect(thrown.statusCode).toBeUndefined();
        });

        it("inserts a shared card (lot_id null) when lot_id is absent", async () => {
            const created = { card_uid: "POOL-004", lot_id: null, status: "available" };
            parkingCardsRepo.insertPoolCard.mockResolvedValue(created);

            const result = await parkingCardsService.createCard({ card_uid: "POOL-004" });

            expect(parkingCardsRepo.insertPoolCard).toHaveBeenCalledWith("POOL-004", null);
            expect(result).toBe(created);
        });
    });

    describe("setStatus error mapping", () => {
        it("maps a null repo result to a 404 'Card not found' error (Req 4.4)", async () => {
            parkingCardsRepo.setStatus.mockResolvedValue(null);

            await expect(
                parkingCardsService.setStatus("MISSING-UID", "lost")
            ).rejects.toMatchObject({ statusCode: 404, message: "Card not found" });
        });

        it("returns the updated row when the card exists", async () => {
            const updated = { card_uid: "POOL-005", lot_id: 1, status: "lost" };
            parkingCardsRepo.setStatus.mockResolvedValue(updated);

            const result = await parkingCardsService.setStatus("POOL-005", "lost");

            expect(parkingCardsRepo.setStatus).toHaveBeenCalledWith("POOL-005", "lost");
            expect(result).toBe(updated);
        });
    });

    describe("deleteCard error mapping", () => {
        it("maps an active session to a 409 'in use' error and does not delete (Req 3.3)", async () => {
            parkingCardsRepo.hasActiveSession.mockResolvedValue(true);

            await expect(
                parkingCardsService.deleteCard("POOL-006")
            ).rejects.toMatchObject({
                statusCode: 409,
                message: "Card is in use and cannot be deleted",
            });
            expect(parkingCardsRepo.deletePoolCard).not.toHaveBeenCalled();
        });

        it("maps a null delete result to a 404 'Card not found' error (Req 3.2)", async () => {
            parkingCardsRepo.hasActiveSession.mockResolvedValue(false);
            parkingCardsRepo.deletePoolCard.mockResolvedValue(null);

            await expect(
                parkingCardsService.deleteCard("MISSING-UID")
            ).rejects.toMatchObject({ statusCode: 404, message: "Card not found" });
        });

        it("returns the deleted row when the card exists and is not in use", async () => {
            const deleted = { card_uid: "POOL-007", lot_id: null, status: "available" };
            parkingCardsRepo.hasActiveSession.mockResolvedValue(false);
            parkingCardsRepo.deletePoolCard.mockResolvedValue(deleted);

            const result = await parkingCardsService.deleteCard("POOL-007");

            expect(result).toBe(deleted);
        });
    });
});
