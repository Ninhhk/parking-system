/**
 * Preservation tests for Bug 3 (missing PUT /api/admin/monthly-subs/:id).
 *
 * These tests run against the UNFIXED controller to establish a baseline of
 * correct behaviors that must be preserved after the Bug 3 fix is applied.
 *
 * All tests MUST PASS on unfixed code.
 *
 * Requirements: 3.5, 3.6
 */

const subsRepo = require("../../repositories/admin.monthlysubs.repo");
const paymentsRepo = require("../../repositories/admin.payments.repo");
const feeRepo = require("../../repositories/admin.feeConfig.repo");
const controller = require("../../controllers/admin.monthlysubs.controller");

jest.mock("../../repositories/admin.monthlysubs.repo");
jest.mock("../../repositories/admin.payments.repo");
jest.mock("../../repositories/admin.feeConfig.repo");

const createResponse = () => ({
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
});

describe("admin.monthlysubs.controller — Bug 3 preservation (unfixed code)", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    /**
     * Preservation 1: GET /api/admin/monthly-subs → 200 with array
     *
     * getAllMonthlySubs must continue to return the full list of subscriptions.
     */
    it("GET returns 200 with the subscriptions array", async () => {
        const fakeSubs = [
            {
                sub_id: 1,
                license_plate: "ABC-123",
                vehicle_type: "car",
                start_date: "2025-01-01",
                end_date: "2025-12-31",
                owner_name: "Alice",
                owner_phone: "0812345678",
            },
            {
                sub_id: 2,
                license_plate: "XYZ-999",
                vehicle_type: "bike",
                start_date: "2025-03-01",
                end_date: "2025-09-01",
                owner_name: "Bob",
                owner_phone: "0898765432",
            },
        ];

        subsRepo.getAllMonthlySubs.mockResolvedValue(fakeSubs);

        const req = {};
        const res = createResponse();

        await controller.getAllMonthlySubs(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            success: true,
            data: fakeSubs,
        });
    });

    /**
     * Preservation 2: POST with valid body → 201 with newMonthlySub and subPayment
     *
     * createMonthlySub must continue to create the subscription and payment
     * record and return both in the response envelope.
     *
     * Requirement 3.5 — overlap detection is tested separately below.
     */
    it("POST with valid body returns 201 with newMonthlySub and subPayment", async () => {
        const newSub = {
            sub_id: 10,
            license_plate: "DEF-456",
            vehicle_type: "car",
            start_date: "2025-06-01",
            end_date: "2025-12-01",
            owner_name: "Carol",
            owner_phone: "0811111111",
        };
        const newPayment = {
            payment_id: 55,
            sub_id: 10,
            payment_date: "2025-06-01T08:00:00.000Z",
            payment_method: "CASH",
            total_amount: 600,
        };

        subsRepo.checkExistingSub.mockResolvedValue("0");
        subsRepo.createMonthlySub.mockResolvedValue(newSub);
        feeRepo.getServiceFee.mockResolvedValue(100);
        paymentsRepo.createMonthlyPayment.mockResolvedValue(newPayment);

        const req = {
            body: {
                license_plate: "DEF-456",
                vehicle_type: "car",
                start_date: "2025-06-01",
                months: 6,
                owner_name: "Carol",
                owner_phone: "0811111111",
                payment_method: "CASH",
            },
        };
        const res = createResponse();

        await controller.createMonthlySub(req, res);

        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith({
            success: true,
            data: {
                newMonthlySub: newSub,
                subPayment: newPayment,
            },
        });
    });

    /**
     * Preservation 3: POST with overlapping dates → 409
     *
     * Requirement 3.5 — the overlap guard must remain intact after the fix.
     */
    it("POST with overlapping dates returns 409", async () => {
        subsRepo.checkExistingSub.mockResolvedValue("1"); // overlap found

        const req = {
            body: {
                license_plate: "ABC-123",
                vehicle_type: "car",
                start_date: "2025-01-01",
                months: 6,
                owner_name: "Alice",
                owner_phone: "0812345678",
                payment_method: "CASH",
            },
        };
        const res = createResponse();

        await controller.createMonthlySub(req, res);

        expect(res.status).toHaveBeenCalledWith(409);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            message: "There is an existing sub with this license plate",
        });
        expect(subsRepo.createMonthlySub).not.toHaveBeenCalled();
    });

    /**
     * Preservation 4: DELETE with valid id → 200
     *
     * Requirement 3.6 — hard-delete behavior must remain intact after the fix.
     */
    it("DELETE with valid id returns 200", async () => {
        subsRepo.deleteMonthlySub.mockResolvedValue({ rowCount: 1 });

        const req = { params: { id: "5" } };
        const res = createResponse();

        await controller.deleteMonthlySub(req, res);

        expect(subsRepo.deleteMonthlySub).toHaveBeenCalledWith("5");
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            success: true,
            message: "Monthly subscription deleted successfully",
        });
    });
});
