const mockPoolQuery = jest.fn();

jest.mock("../../config/db", () => ({
    pool: {
        query: (...args) => mockPoolQuery(...args),
    },
}));

const employeeMonitorRepo = require("../../repositories/employee.monitor.repo");

describe("employee.monitor.repo getMyLot", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("selects casual_entry_mode in the lot query", async () => {
        mockPoolQuery.mockResolvedValue({
            rows: [{ lot_id: 1, casual_entry_mode: "issued_card" }],
        });

        await employeeMonitorRepo.getMyLot(42);

        const [sql, params] = mockPoolQuery.mock.calls[0];
        expect(sql).toContain("casual_entry_mode");
        expect(params).toEqual([42]);
    });

    it("returns the row including casual_entry_mode", async () => {
        const row = {
            lot_id: 1,
            lot_name: "Demo Lot",
            car_capacity: 100,
            bike_capacity: 50,
            current_car: 10,
            current_bike: 5,
            casual_entry_mode: "issued_card",
            manager_username: "alice",
        };
        mockPoolQuery.mockResolvedValue({ rows: [row] });

        const result = await employeeMonitorRepo.getMyLot(42);

        expect(result).toEqual(row);
        expect(result.casual_entry_mode).toBe("issued_card");
    });
});
