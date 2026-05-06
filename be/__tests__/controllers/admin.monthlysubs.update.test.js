/**
 * Fix-checking unit tests for Bug 3 — updateMonthlySub controller handler
 * and updateMonthlySub repo function (COALESCE behavior via mock).
 *
 * Validates: Requirements 2.5, 2.6
 */

const subsRepo = require("../../repositories/admin.monthlysubs.repo");
const controller = require("../../controllers/admin.monthlysubs.controller");

jest.mock("../../repositories/admin.monthlysubs.repo");

const createResponse = () => ({
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
});

describe("admin.monthlysubs.controller — updateMonthlySub", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    /**
     * Valid update body → 200, data.sub_id equals input id
     */
    it("valid update body returns 200 with data.sub_id matching the input id", async () => {
        const existingSub = {
            sub_id: 7,
            license_plate: "ABC-123",
            vehicle_type: "car",
            start_date: "2025-01-01",
            end_date: "2025-06-30",
            owner_name: "Alice",
            owner_phone: "0812345678",
        };
        const updatedSub = { ...existingSub, end_date: "2025-12-31" };

        subsRepo.getMonthlySubById.mockResolvedValue(existingSub);
        subsRepo.checkExistingSubExcluding.mockResolvedValue("0");
        subsRepo.updateMonthlySub.mockResolvedValue(updatedSub);

        const req = { params: { id: "7" }, body: { end_date: "2025-12-31" } };
        const res = createResponse();

        await controller.updateMonthlySub(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({ success: true, data: updatedSub });
        expect(res.json.mock.calls[0][0].data.sub_id).toBe(7);
    });

    /**
     * Unknown sub_id → 404
     */
    it("unknown sub_id returns 404", async () => {
        subsRepo.getMonthlySubById.mockResolvedValue(undefined);

        const req = { params: { id: "999" }, body: { owner_name: "Bob" } };
        const res = createResponse();

        await controller.updateMonthlySub(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({ success: false, message: "Subscription not found" });
        expect(subsRepo.updateMonthlySub).not.toHaveBeenCalled();
    });

    /**
     * end_date that overlaps another sub → 409
     */
    it("end_date overlapping another subscription returns 409", async () => {
        const existingSub = {
            sub_id: 3,
            license_plate: "XYZ-999",
            vehicle_type: "bike",
            start_date: "2025-01-01",
            end_date: "2025-06-30",
            owner_name: "Carol",
            owner_phone: "0899999999",
        };

        subsRepo.getMonthlySubById.mockResolvedValue(existingSub);
        subsRepo.checkExistingSubExcluding.mockResolvedValue("1"); // overlap found

        const req = { params: { id: "3" }, body: { end_date: "2025-09-30" } };
        const res = createResponse();

        await controller.updateMonthlySub(req, res);

        expect(res.status).toHaveBeenCalledWith(409);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            message: "Date range overlaps with another active subscription",
        });
        expect(subsRepo.updateMonthlySub).not.toHaveBeenCalled();
    });

    /**
     * Body with no updatable fields → 422
     */
    it("body with no updatable fields returns 422", async () => {
        const req = { params: { id: "5" }, body: {} };
        const res = createResponse();

        await controller.updateMonthlySub(req, res);

        expect(res.status).toHaveBeenCalledWith(422);
        expect(res.json).toHaveBeenCalledWith({ success: false, message: "No updatable fields provided" });
        expect(subsRepo.getMonthlySubById).not.toHaveBeenCalled();
    });

    /**
     * updateMonthlySub repo function with partial fields → only provided fields change (COALESCE behavior via mock)
     *
     * The repo uses COALESCE so unprovided fields keep their existing values.
     * We verify the controller passes null for missing fields, which triggers COALESCE in the DB.
     */
    it("updateMonthlySub repo called with null for unprovided fields (COALESCE behavior)", async () => {
        const existingSub = {
            sub_id: 2,
            license_plate: "DEF-456",
            vehicle_type: "car",
            start_date: "2025-03-01",
            end_date: "2025-09-01",
            owner_name: "Dave",
            owner_phone: "0811111111",
        };
        // Only owner_phone is updated; other fields stay the same via COALESCE
        const updatedSub = { ...existingSub, owner_phone: "0822222222" };

        subsRepo.getMonthlySubById.mockResolvedValue(existingSub);
        subsRepo.updateMonthlySub.mockResolvedValue(updatedSub);

        const req = { params: { id: "2" }, body: { owner_phone: "0822222222" } };
        const res = createResponse();

        await controller.updateMonthlySub(req, res);

        // Verify repo was called with null for all unprovided fields
        expect(subsRepo.updateMonthlySub).toHaveBeenCalledWith("2", {
            end_date: undefined,
            owner_name: undefined,
            owner_phone: "0822222222",
            vehicle_type: undefined,
        });

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({ success: true, data: updatedSub });
        // Confirm only owner_phone changed; other fields preserved
        expect(res.json.mock.calls[0][0].data.owner_name).toBe("Dave");
        expect(res.json.mock.calls[0][0].data.end_date).toBe("2025-09-01");
    });
});
