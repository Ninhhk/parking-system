import { render, screen, fireEvent } from "@testing-library/react";
import SessionDetailModal from "@/app/components/employee/audit/SessionDetailModal";

describe("SessionDetailModal", () => {
    const mockSession = {
        session_id: 1,
        license_plate: "51F-123.45",
        vehicle_type: "car",
        lot_name: "Lot A",
        time_in: "2024-01-15T08:30:00.000Z",
        time_out: "2024-01-15T17:45:00.000Z",
        parking_fee: 50000,
        status: "Completed",
        is_lost: false,
        image_in_url: "https://minio.example.com/entry.jpg",
        image_out_url: "https://minio.example.com/exit.jpg",
    };

    it("renders nothing when session is null", () => {
        const { container } = render(<SessionDetailModal session={null} onClose={jest.fn()} />);
        expect(container.firstChild).toBeNull();
    });

    it("shows all session detail fields", () => {
        render(<SessionDetailModal session={mockSession} onClose={jest.fn()} />);

        expect(screen.getByText("51F-123.45")).toBeInTheDocument();
        expect(screen.getByText("car")).toBeInTheDocument();
        expect(screen.getByText("Lot A")).toBeInTheDocument();
        expect(screen.getByText("Session Details")).toBeInTheDocument();
    });

    it("shows images when URLs are provided", () => {
        render(<SessionDetailModal session={mockSession} onClose={jest.fn()} />);

        const entryImg = screen.getByAltText("Entry");
        const exitImg = screen.getByAltText("Exit");

        expect(entryImg).toHaveAttribute("src", "https://minio.example.com/entry.jpg");
        expect(exitImg).toHaveAttribute("src", "https://minio.example.com/exit.jpg");
    });

    it("shows 'No image available' placeholder when image_in_url is null", () => {
        const sessionNoEntry = { ...mockSession, image_in_url: null };
        render(<SessionDetailModal session={sessionNoEntry} onClose={jest.fn()} />);

        expect(screen.getByText("No image available")).toBeInTheDocument();
        // Exit image should still render
        expect(screen.getByAltText("Exit")).toBeInTheDocument();
    });

    it("shows 'No image available' placeholder when image_out_url is null", () => {
        const sessionNoExit = { ...mockSession, image_out_url: null };
        render(<SessionDetailModal session={sessionNoExit} onClose={jest.fn()} />);

        expect(screen.getByText("No image available")).toBeInTheDocument();
        // Entry image should still render
        expect(screen.getByAltText("Entry")).toBeInTheDocument();
    });

    it("shows two placeholders when both image URLs are null", () => {
        const sessionNoImages = { ...mockSession, image_in_url: null, image_out_url: null };
        render(<SessionDetailModal session={sessionNoImages} onClose={jest.fn()} />);

        const placeholders = screen.getAllByText("No image available");
        expect(placeholders).toHaveLength(2);
    });

    it("calls onClose when close button is clicked", () => {
        const onClose = jest.fn();
        render(<SessionDetailModal session={mockSession} onClose={onClose} />);

        fireEvent.click(screen.getByLabelText("Close"));

        expect(onClose).toHaveBeenCalled();
    });
});
