"use client";

import { isValidCardUid } from "@/app/employee/checkin/components/ReaderPanel";

/**
 * Parking card form component for adding a pool card.
 *
 * Controlled component used inside the Card Pool add modal (the Modal owns the
 * <form>, so this renders fields only). It supports Scan_To_Fill: a USB RFID
 * reader types the UID followed by Enter, so we preventDefault on Enter to keep
 * the keystroke from submitting the add-card form (Req 2.5).
 *
 * @param {Object} props
 * @param {Object} props.form - Form data ({ card_uid, lot_id })
 * @param {Function} props.onChange - Change handler ({ target: { name, value } })
 * @param {Array} props.lotOptions - Assigned_Lot options ([{ value, label }])
 */
export default function ParkingCardForm({ form, onChange, lotOptions = [] }) {
    const labelClass = "block text-gray-700 font-medium mb-2";
    const inputClass =
        "w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm";

    // Scan_To_Fill: the reader emits the UID then an Enter. Prevent Enter from
    // submitting the form so the reader only fills the field (Req 2.5).
    const handleCardUidKeyDown = (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
        }
    };

    // "Shared" option maps to lot_id = null; otherwise a numeric lot id.
    const handleLotChange = (e) => {
        const raw = e.target.value;
        const value = raw === "" ? null : Number(raw);
        onChange({ target: { name: "lot_id", value } });
    };

    const showInvalid = !!form.card_uid && !isValidCardUid(form.card_uid);

    return (
        <>
            <div className="mb-2">
                <label htmlFor="card_uid" className={labelClass}>
                    Card UID <span className="text-red-500">*</span>
                </label>
                <input
                    id="card_uid"
                    name="card_uid"
                    type="text"
                    value={form.card_uid || ""}
                    onChange={onChange}
                    onKeyDown={handleCardUidKeyDown}
                    required
                    maxLength={100}
                    placeholder="Scan or type UID (e.g. CARD-0000)"
                    className={inputClass}
                />
                {showInvalid && (
                    <p className="mt-1 text-sm text-red-600">
                        Invalid UID — only letters, digits, and hyphens (1-100 chars).
                    </p>
                )}
            </div>

            <div className="mb-2">
                <label htmlFor="lot_id" className={labelClass}>
                    Assigned Lot
                </label>
                <select
                    id="lot_id"
                    name="lot_id"
                    value={form.lot_id == null ? "" : String(form.lot_id)}
                    onChange={handleLotChange}
                    className={inputClass}
                >
                    <option value="">Shared (all lots)</option>
                    {lotOptions.map((option) => (
                        <option key={option.value} value={String(option.value)}>
                            {option.label}
                        </option>
                    ))}
                </select>
            </div>
        </>
    );
}
