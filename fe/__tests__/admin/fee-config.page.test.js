import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import FeeConfigPage from "@/app/admin/fee-config/page";
import Sidebar from "@/app/components/admin/Sidebar";

const mockGetActiveFeeConfigs = jest.fn();
const mockGetFeeConfigVersions = jest.fn();
const mockCreateFeeConfigVersion = jest.fn();
let mockUser = { permissions: { can_edit_fees: true } };

jest.mock("@/app/api/admin.client", () => ({
    getActiveFeeConfigs: (...args) => mockGetActiveFeeConfigs(...args),
    getFeeConfigVersions: (...args) => mockGetFeeConfigVersions(...args),
    createFeeConfigVersion: (...args) => mockCreateFeeConfigVersion(...args),
    fetchFeeConfigurations: jest.fn(),
    updateFeeConfiguration: jest.fn(),
}));

jest.mock("@/app/components/providers/UserProvider", () => ({
    useUser: () => ({ user: mockUser }),
}));

jest.mock("next/navigation", () => ({
    usePathname: () => "/admin/fee-config",
}));

// ─── Test data ───────────────────────────────────────────────────────────────

const activeConfigs = {
    car: {
        config_version_id: 1,
        vehicle_type: "car",
        effective_from: "2025-01-01T00:00:00Z",
        rounding_strategy: "ceil_hour",
        grace_period_minutes: 0,
        hourly_rate: 10000,
        daily_cap_enabled: false,
        daily_cap_amount: 0,
        tiered_rate_enabled: false,
        tiers: [],
        time_of_day_enabled: false,
        time_windows: [],
        penalty_fee: 50000,
    },
    bike: {
        config_version_id: 2,
        vehicle_type: "bike",
        effective_from: "2025-01-01T00:00:00Z",
        rounding_strategy: "ceil_hour",
        grace_period_minutes: 0,
        hourly_rate: 5000,
        daily_cap_enabled: false,
        daily_cap_amount: 0,
        tiered_rate_enabled: false,
        tiers: [],
        time_of_day_enabled: false,
        time_windows: [],
        penalty_fee: 30000,
    },
};

const versions = [
    {
        config_version_id: 1,
        effective_from: "2025-01-01T00:00:00Z",
        created_by: 1,
        created_at: "2025-01-01T00:00:00Z",
        hourly_rate: 10000,
        rounding_strategy: "ceil_hour",
    },
];

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("FeeConfigPage", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockGetActiveFeeConfigs.mockResolvedValue(activeConfigs);
        mockGetFeeConfigVersions.mockResolvedValue(versions);
        mockUser = { permissions: { can_edit_fees: true } };
    });

    // 17.1 — Active config panel renders both vehicle types
    it("renders active config panel for both vehicle types", async () => {
        render(<FeeConfigPage />);

        await waitFor(() => {
            expect(screen.getByText("car")).toBeInTheDocument();
            expect(screen.getByText("bike")).toBeInTheDocument();
        });

        expect(screen.getAllByText(/car|bike/i).length).toBeGreaterThanOrEqual(2);
    });

    // 17.2 — Version history table headers and data
    it("displays version history table with version data", async () => {
        render(<FeeConfigPage />);

        await waitFor(() => {
            // Table header "Effective from" appears in the <th> (among other places)
            const effectiveFromEls = screen.getAllByText("Effective from");
            expect(effectiveFromEls.length).toBeGreaterThanOrEqual(1);
            expect(screen.getByText("Created by")).toBeInTheDocument();
            expect(screen.getAllByText("Hourly rate").length).toBeGreaterThanOrEqual(1);
        });

        await waitFor(() => {
            expect(screen.getAllByText("10000").length).toBeGreaterThanOrEqual(1);
            expect(screen.getAllByText("ceil_hour").length).toBeGreaterThanOrEqual(1);
        });
    });

    // 17.3 — Inline validation errors on 422
    it("shows inline validation errors on 422 response from createFeeConfigVersion", async () => {
        const validationError = {
            response: {
                status: 422,
                data: {
                    success: false,
                    message: "Validation failed",
                    fields: [{ field: "hourly_rate", message: "Must be >= 0" }],
                },
            },
        };
        mockCreateFeeConfigVersion.mockRejectedValue(validationError);

        render(<FeeConfigPage />);

        await waitFor(() => {
            expect(screen.getByText("Save config version")).toBeInTheDocument();
        });

        const effectiveFromInput = screen.getByLabelText(/effective from/i);
        fireEvent.change(effectiveFromInput, { target: { value: "2030-01-01T00:00:00" } });

        fireEvent.click(screen.getByText("Save config version"));

        await waitFor(() => {
            expect(screen.getByText("Must be >= 0")).toBeInTheDocument();
        });
    });

    // 17.4 — Confirmation dialog for past effective_from
    it("shows confirmation dialog when effective_from is set to a past date", async () => {
        mockCreateFeeConfigVersion.mockResolvedValue({ config_version_id: 99 });

        const confirmSpy = jest.spyOn(window, "confirm").mockReturnValue(false);

        render(<FeeConfigPage />);

        await waitFor(() => {
            expect(screen.getByText("Save config version")).toBeInTheDocument();
        });

        const effectiveFromInput = screen.getByLabelText(/effective from/i);
        fireEvent.change(effectiveFromInput, { target: { value: "2020-01-01T00:00:00" } });

        fireEvent.click(screen.getByText("Save config version"));

        await waitFor(() => {
            expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining("past"));
        });

        expect(mockCreateFeeConfigVersion).not.toHaveBeenCalled();

        confirmSpy.mockRestore();
    });

    // 17.5a — 403 message when user lacks can_edit_fees
    it("shows 403 message when user lacks can_edit_fees permission", () => {
        mockUser = { permissions: {} };

        render(<FeeConfigPage />);

        expect(
            screen.getByText(/You do not have permission to access this page/i)
        ).toBeInTheDocument();
        expect(screen.queryByText("Active Configuration")).not.toBeInTheDocument();
    });
});

// ─── Sidebar permission tests ─────────────────────────────────────────────────

describe("Sidebar — Pricing Engine link visibility", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("hides Pricing Engine sidebar link for users without can_edit_fees", () => {
        mockUser = { permissions: {} };
        render(<Sidebar />);
        expect(screen.queryByText("Pricing Engine")).not.toBeInTheDocument();
    });

    it("shows Pricing Engine sidebar link for users with can_edit_fees", () => {
        mockUser = { permissions: { can_edit_fees: true } };
        render(<Sidebar />);
        // Sidebar renders both mobile and desktop nav — at least one link should be present
        expect(screen.getAllByText("Pricing Engine").length).toBeGreaterThanOrEqual(1);
    });
});
