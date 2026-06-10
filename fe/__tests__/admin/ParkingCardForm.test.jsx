import { render, screen, fireEvent } from "@testing-library/react";
import ParkingCardForm from "@/app/components/admin/ParkingCardForm";

// Scan_To_Fill (Req 2.5): a USB RFID reader types the UID followed by Enter.
// The card_uid input must call preventDefault on Enter so the keystroke fills
// the field without submitting the add-card form.

describe("ParkingCardForm — Scan_To_Fill Enter handling (Req 2.5)", () => {
    it("prevents the Enter key from submitting the add-card form", () => {
        const handleSubmit = jest.fn((e) => e.preventDefault());
        const handleChange = jest.fn();

        render(
            <form onSubmit={handleSubmit}>
                <ParkingCardForm
                    form={{ card_uid: "CARD-0001", lot_id: null }}
                    onChange={handleChange}
                    lotOptions={[]}
                />
            </form>
        );

        const input = screen.getByLabelText(/card uid/i);

        // fireEvent returns false when a handler calls preventDefault on a
        // cancelable event — this confirms the Enter keydown is blocked (2.5).
        const notPrevented = fireEvent.keyDown(input, { key: "Enter" });
        expect(notPrevented).toBe(false);

        // The Enter key never triggers the surrounding form's submit handler.
        expect(handleSubmit).not.toHaveBeenCalled();
    });

    it("does not block other keys (only Enter is intercepted)", () => {
        const handleChange = jest.fn();

        render(
            <ParkingCardForm
                form={{ card_uid: "", lot_id: null }}
                onChange={handleChange}
                lotOptions={[]}
            />
        );

        const input = screen.getByLabelText(/card uid/i);

        // A non-Enter key is not prevented (dispatchEvent returns true).
        const notPrevented = fireEvent.keyDown(input, { key: "a" });
        expect(notPrevented).toBe(true);
    });
});
