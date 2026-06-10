import { render, screen, within } from "@testing-library/react";
import ParkingLotForm from "@/app/components/admin/ParkingLotForm";

// Minimal props shared across tests
const baseForm = {
    lot_name: "Lot A",
    car_capacity: 100,
    bike_capacity: 50,
    managed_by: "",
    casual_entry_mode: "issued_card",
};

const noop = () => {};

describe("ParkingLotForm — casual entry mode selector", () => {
    // 6.1 / 6.4 — selector shows current value inside the commissioning section
    it("shows the lot's current casual_entry_mode within the commissioning section in edit mode", () => {
        render(
            <ParkingLotForm
                form={baseForm}
                onChange={noop}
                managerOptions={[]}
                isEditMode={true}
            />
        );

        // 6.4 — selector is presented under the lane hardware / commissioning section
        const heading = screen.getByText("Lane hardware / commissioning");
        const section = heading.closest("div");
        const selector = within(section).getByLabelText(/casual entry mode/i);

        // 6.1 — the selector reflects the lot's current value
        expect(selector).toBeInTheDocument();
        expect(selector).toHaveValue("issued_card");
    });

    // 6.1 — both modes are offered as selectable choices
    it("offers session_ticket and issued_card as selectable choices", () => {
        render(
            <ParkingLotForm
                form={baseForm}
                onChange={noop}
                managerOptions={[]}
                isEditMode={true}
            />
        );

        expect(screen.getByRole("option", { name: "Session ticket" })).toBeInTheDocument();
        expect(screen.getByRole("option", { name: "Issued card" })).toBeInTheDocument();
    });

    // 6.4 — commissioning config, not a daily switch: hidden when creating a new lot
    it("does not render the casual_entry_mode selector outside edit mode", () => {
        render(
            <ParkingLotForm
                form={baseForm}
                onChange={noop}
                managerOptions={[]}
                isEditMode={false}
            />
        );

        expect(screen.queryByLabelText(/casual entry mode/i)).not.toBeInTheDocument();
        expect(screen.queryByText("Lane hardware / commissioning")).not.toBeInTheDocument();
    });
});
