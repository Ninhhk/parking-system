import { render, screen, fireEvent } from "@testing-library/react";
import SessionAuditTable from "@/app/components/employee/audit/SessionAuditTable";

describe("SessionAuditTable", () => {
    const mockSessions = [
        {
            session_id: 1,
            license_plate: "51F-123.45",
            vehicle_type: "car",
            lot_name: "Lot A",
            time_in: "2024-01-15T08:30:00.000Z",
            time_out: "2024-01-15T17:45:00.000Z",
            status: "Completed",
            is_lost: false,
        },
        {
            session_id: 2,
            license_plate: "30A-999.99",
            vehicle_type: "bike",
            lot_name: "Lot B",
            time_in: "2024-01-16T09:00:00.000Z",
            time_out: null,
            status: "Active",
            is_lost: false,
        },
    ];

    it("renders correct table column headers", () => {
        render(<SessionAuditTable sessions={mockSessions} />);

        expect(screen.getByText("License Plate")).toBeInTheDocument();
        expect(screen.getByText("Vehicle Type")).toBeInTheDocument();
        expect(screen.getByText("Lot Name")).toBeInTheDocument();
        expect(screen.getByText("Time In")).toBeInTheDocument();
        expect(screen.getByText("Time Out")).toBeInTheDocument();
        expect(screen.getByText("Status")).toBeInTheDocument();
    });

    it("renders session rows with correct data", () => {
        render(<SessionAuditTable sessions={mockSessions} />);

        expect(screen.getByText("51F-123.45")).toBeInTheDocument();
        expect(screen.getByText("30A-999.99")).toBeInTheDocument();
        expect(screen.getByText("Lot A")).toBeInTheDocument();
        expect(screen.getByText("Lot B")).toBeInTheDocument();
        expect(screen.getByText("Completed")).toBeInTheDocument();
        expect(screen.getByText("Active")).toBeInTheDocument();
    });

    it("shows empty state message when sessions array is empty", () => {
        render(<SessionAuditTable sessions={[]} />);

        expect(screen.getByText("No sessions match the current filters.")).toBeInTheDocument();
    });

    it("shows empty state when sessions prop is not provided", () => {
        render(<SessionAuditTable />);

        expect(screen.getByText("No sessions match the current filters.")).toBeInTheDocument();
    });

    it("calls onRowClick when a row is clicked", () => {
        const onRowClick = jest.fn();
        render(<SessionAuditTable sessions={mockSessions} onRowClick={onRowClick} />);

        fireEvent.click(screen.getByText("51F-123.45"));

        expect(onRowClick).toHaveBeenCalledWith(mockSessions[0]);
    });
});
