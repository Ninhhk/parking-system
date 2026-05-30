import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AuditPage from "@/app/employee/audit/page";

jest.mock("@/app/api/employee.audit.client", () => ({
    fetchAuditSessions: jest.fn(),
}));

jest.mock("@/app/api/employee.client", () => ({
    fetchParkingLots: jest.fn().mockResolvedValue([]),
}));

import { fetchAuditSessions } from "@/app/api/employee.audit.client";

describe("AuditPage pagination controls", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("disables Previous button on first page", async () => {
        fetchAuditSessions.mockResolvedValue({
            sessions: [{ session_id: 1, license_plate: "51F-001", vehicle_type: "car", lot_name: "Lot A", time_in: "2024-01-15T08:00:00Z", time_out: "2024-01-15T10:00:00Z", status: "Completed", is_lost: false }],
            pagination: { page: 1, pageSize: 20, totalCount: 40, totalPages: 2 },
        });

        render(<AuditPage />);

        await waitFor(() => {
            expect(screen.getByText("51F-001")).toBeInTheDocument();
        });

        const prevButton = screen.getByRole("button", { name: /previous/i });
        expect(prevButton).toBeDisabled();
    });

    it("disables Next button on last page (totalPages = 1)", async () => {
        fetchAuditSessions.mockResolvedValue({
            sessions: [{ session_id: 2, license_plate: "51F-002", vehicle_type: "bike", lot_name: "Lot B", time_in: "2024-01-14T08:00:00Z", time_out: "2024-01-14T10:00:00Z", status: "Completed", is_lost: false }],
            pagination: { page: 1, pageSize: 20, totalCount: 5, totalPages: 1 },
        });

        render(<AuditPage />);

        await waitFor(() => {
            expect(screen.getByText("51F-002")).toBeInTheDocument();
        });

        const nextButton = screen.getByRole("button", { name: /next/i });
        expect(nextButton).toBeDisabled();
    });

    it("enables Next button when there are more pages", async () => {
        fetchAuditSessions.mockResolvedValue({
            sessions: [{ session_id: 3, license_plate: "51F-003", vehicle_type: "car", lot_name: "Lot C", time_in: "2024-01-13T08:00:00Z", time_out: "2024-01-13T10:00:00Z", status: "Completed", is_lost: false }],
            pagination: { page: 1, pageSize: 20, totalCount: 60, totalPages: 3 },
        });

        render(<AuditPage />);

        await waitFor(() => {
            expect(screen.getByText("51F-003")).toBeInTheDocument();
        });

        const nextButton = screen.getByRole("button", { name: /next/i });
        expect(nextButton).not.toBeDisabled();
    });

    it("enables Previous button after navigating to page 2", async () => {
        fetchAuditSessions
            .mockResolvedValueOnce({
                sessions: [{ session_id: 1, license_plate: "51F-P1", vehicle_type: "car", lot_name: "Lot A", time_in: "2024-01-15T08:00:00Z", time_out: "2024-01-15T10:00:00Z", status: "Completed", is_lost: false }],
                pagination: { page: 1, pageSize: 20, totalCount: 60, totalPages: 3 },
            })
            .mockResolvedValueOnce({
                sessions: [{ session_id: 2, license_plate: "51F-P2", vehicle_type: "car", lot_name: "Lot A", time_in: "2024-01-14T08:00:00Z", time_out: "2024-01-14T10:00:00Z", status: "Completed", is_lost: false }],
                pagination: { page: 2, pageSize: 20, totalCount: 60, totalPages: 3 },
            });

        render(<AuditPage />);

        await waitFor(() => {
            expect(screen.getByText("51F-P1")).toBeInTheDocument();
        });

        // Navigate to page 2
        fireEvent.click(screen.getByRole("button", { name: /next/i }));

        await waitFor(() => {
            expect(screen.getByText("51F-P2")).toBeInTheDocument();
        });

        const prevButton = screen.getByRole("button", { name: /previous/i });
        expect(prevButton).not.toBeDisabled();
    });

    it("does not show pagination controls when totalCount is 0", async () => {
        fetchAuditSessions.mockResolvedValue({
            sessions: [],
            pagination: { page: 1, pageSize: 20, totalCount: 0, totalPages: 0 },
        });

        render(<AuditPage />);

        await waitFor(() => {
            expect(screen.getByText("No sessions match the current filters.")).toBeInTheDocument();
        });

        expect(screen.queryByRole("button", { name: /previous/i })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /next/i })).not.toBeInTheDocument();
    });
});
