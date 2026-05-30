import { render, screen, fireEvent } from "@testing-library/react";
import FilterBar from "@/app/components/employee/audit/FilterBar";

describe("FilterBar", () => {
    const mockLots = [
        { lot_id: 1, lot_name: "Lot A" },
        { lot_id: 2, lot_name: "Lot B" },
    ];

    it("renders all filter inputs", () => {
        render(<FilterBar onSearch={jest.fn()} lots={mockLots} />);

        expect(screen.getByLabelText("License Plate")).toBeInTheDocument();
        expect(screen.getByLabelText("Start Date")).toBeInTheDocument();
        expect(screen.getByLabelText("End Date")).toBeInTheDocument();
        expect(screen.getByLabelText("Vehicle Type")).toBeInTheDocument();
        expect(screen.getByLabelText("Parking Lot")).toBeInTheDocument();
    });

    it("renders search and reset buttons", () => {
        render(<FilterBar onSearch={jest.fn()} lots={mockLots} />);

        expect(screen.getByRole("button", { name: /search/i })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /reset/i })).toBeInTheDocument();
    });

    it("renders lot options from props", () => {
        render(<FilterBar onSearch={jest.fn()} lots={mockLots} />);

        expect(screen.getByRole("option", { name: "Lot A" })).toBeInTheDocument();
        expect(screen.getByRole("option", { name: "Lot B" })).toBeInTheDocument();
    });

    it("renders vehicle type options", () => {
        render(<FilterBar onSearch={jest.fn()} lots={mockLots} />);

        expect(screen.getByRole("option", { name: "All" })).toBeInTheDocument();
        expect(screen.getByRole("option", { name: "Car" })).toBeInTheDocument();
        expect(screen.getByRole("option", { name: "Bike" })).toBeInTheDocument();
    });

    it("calls onSearch with active filters when search is clicked", () => {
        const onSearch = jest.fn();
        render(<FilterBar onSearch={onSearch} lots={mockLots} />);

        fireEvent.change(screen.getByLabelText("License Plate"), { target: { value: "51F" } });
        fireEvent.change(screen.getByLabelText("Vehicle Type"), { target: { value: "car" } });
        fireEvent.click(screen.getByRole("button", { name: /search/i }));

        expect(onSearch).toHaveBeenCalledWith({ plate: "51F", vehicleType: "car" });
    });

    it("calls onReset and clears filters when reset is clicked", () => {
        const onReset = jest.fn();
        render(<FilterBar onSearch={jest.fn()} onReset={onReset} lots={mockLots} />);

        fireEvent.change(screen.getByLabelText("License Plate"), { target: { value: "ABC" } });
        fireEvent.click(screen.getByRole("button", { name: /reset/i }));

        expect(onReset).toHaveBeenCalled();
        expect(screen.getByLabelText("License Plate")).toHaveValue("");
    });

    it("omits empty filters from onSearch payload", () => {
        const onSearch = jest.fn();
        render(<FilterBar onSearch={onSearch} lots={mockLots} />);

        // Click search without filling anything
        fireEvent.click(screen.getByRole("button", { name: /search/i }));

        expect(onSearch).toHaveBeenCalledWith({});
    });
});
