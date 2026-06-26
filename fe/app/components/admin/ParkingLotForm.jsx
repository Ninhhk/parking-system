"use client";

import FormField from "../common/FormField";

const CASUAL_ENTRY_MODE_OPTIONS = [
    { value: "session_ticket", label: "Session ticket" },
    { value: "issued_card", label: "Issued card" },
];

/**
 * Parking lot form component for create/edit
 *
 * @param {Object} props
 * @param {Object} props.form - Form data
 * @param {Function} props.onChange - Change handler
 * @param {Array} props.managerOptions - Options for the manager dropdown
 * @param {boolean} props.isEditMode - Whether form is in edit mode
 */
export default function ParkingLotForm({ form, onChange, managerOptions, isEditMode = false }) {
    return (
        <>
            <FormField name="lot_name" label="Name" value={form.lot_name} onChange={onChange} required />

            <FormField
                name="car_capacity"
                label="Car Capacity"
                type="number"
                value={form.car_capacity}
                onChange={onChange}
                min={0}
                required
            />

            <FormField
                name="bike_capacity"
                label="Bike Capacity"
                type="number"
                value={form.bike_capacity}
                onChange={onChange}
                min={0}
                required
            />

            {isEditMode && (
                <FormField
                    name="managed_by"
                    label="Managed by"
                    type="select"
                    value={form.managed_by || ""}
                    onChange={onChange}
                    options={managerOptions}
                />
            )}

            {isEditMode && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                    <h3 className="text-sm font-semibold text-gray-800">Lane hardware / commissioning</h3>
                    <p className="mb-2 text-xs text-gray-500">
                        Commissioning config tied to lane hardware, not a daily switch.
                    </p>
                    <FormField
                        name="casual_entry_mode"
                        label="Casual entry mode"
                        type="select"
                        value={form.casual_entry_mode || ""}
                        onChange={onChange}
                        options={CASUAL_ENTRY_MODE_OPTIONS}
                    />
                </div>
            )}
        </>
    );
}
