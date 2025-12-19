"use client";

import FormField from "../common/FormField";

/**
 * Monthly subscription form component
 *
 * @param {Object} props
 * @param {Object} props.form - Form data
 * @param {Function} props.onChange - Change handler
 * @param {Array} props.vehicleTypeOptions - Options for the vehicle type dropdown
 * @param {Array} props.paymentMethodOptions - Options for the payment method dropdown
 */
export default function MonthlySubForm({ form, onChange, vehicleTypeOptions, paymentMethodOptions }) {
    return (
        <>
            <FormField
                name="license_plate"
                label="License Plate"
                value={form.license_plate}
                onChange={onChange}
                required
            />

            <FormField
                name="vehicle_type"
                label="Vehicle Type"
                type="select"
                value={form.vehicle_type}
                onChange={onChange}
                options={vehicleTypeOptions}
                required
            />

            <FormField
                name="start_date"
                label="Start Date"
                type="date"
                value={form.start_date}
                onChange={onChange}
                required
            />

            <FormField
                name="months"
                label="Months"
                type="number"
                value={form.months}
                onChange={onChange}
                min={1}
                required
            />

            <FormField name="owner_name" label="Owner Name" value={form.owner_name} onChange={onChange} required />

            <FormField name="owner_phone" label="Owner Phone" value={form.owner_phone} onChange={onChange} required />

            <FormField
                name="payment_method"
                label="Payment Method"
                type="select"
                value={form.payment_method}
                onChange={onChange}
                options={paymentMethodOptions}
                required
            />
        </>
    );
}
