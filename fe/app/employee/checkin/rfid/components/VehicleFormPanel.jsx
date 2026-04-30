const VEHICLE_OPTIONS = [
    { value: "car", label: "Car" },
    { value: "bike", label: "Bike" },
];

export default function VehicleFormPanel({ value, onChange, disabled, onSubmit }) {
    return (
        <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="text-lg font-semibold text-slate-800">Vehicle Type</h2>
            <p className="mt-1 text-sm text-slate-500">Select the vehicle type before check-in.</p>

            <div className="mt-4 flex gap-3">
                {VEHICLE_OPTIONS.map((option) => (
                    <label
                        key={option.value}
                        className="flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700"
                    >
                        <input
                            type="radio"
                            name="vehicle_type"
                            value={option.value}
                            checked={value === option.value}
                            onChange={onChange}
                            disabled={disabled}
                        />
                        {option.label}
                    </label>
                ))}
            </div>

            <button
                type="button"
                onClick={onSubmit}
                disabled={disabled}
                className="mt-4 w-full rounded-md bg-slate-800 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
                Check in with RFID
            </button>
        </section>
    );
}
