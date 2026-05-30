import SubscriptionBadge from "./SubscriptionBadge";

const VEHICLE_OPTIONS = [
    { 
        value: "car", 
        label: "Car",
        icon: (
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9C2.1 11 2 11.2 2 11.5V16c0 .6.4 1 1 1h2m10 0h2m-12 0a3 3 0 116 0H9m9 0a3 3 0 116 0h-6" />
            </svg>
        )
    },
    { 
        value: "bike", 
        label: "Bike",
        icon: (
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5.5 17a2.5 2.5 0 100-5 2.5 2.5 0 000 5zm13 0a2.5 2.5 0 100-5 2.5 2.5 0 000 5zm-13-2.5h13m-3.5-3.5h-4.5m8-2.5l-2.5 2.5" />
            </svg>
        )
    },
];

export default function VehicleFormPanel({ value, onChange, disabled, onSubmit, subscription, subscriptionLoading, subscriptionError }) {
    const submitDisabled = disabled || !value;

    return (
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3 border-b border-gray-200 pb-3 mb-4">
                <div className="p-2 rounded bg-indigo-50 text-indigo-600">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                    </svg>
                </div>
                <div>
                    <h2 className="text-sm font-semibold text-slate-800 uppercase tracking-wider">Vehicle Class Selection</h2>
                    <p className="text-xs text-slate-500">Select vehicle class</p>
                </div>
            </div>

            {subscriptionLoading && (
                <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-indigo-50 border border-indigo-100">
                    <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                    <span className="text-xs font-mono text-indigo-700">Looking up subscription...</span>
                </div>
            )}

            {subscriptionError && (
                <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-rose-50 border border-rose-200">
                    <svg className="w-4 h-4 text-rose-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-xs font-mono text-rose-700">Subscription lookup failed — select vehicle type manually</span>
                </div>
            )}

            {subscription && <SubscriptionBadge subscription={subscription} />}

            <div className="grid grid-cols-2 gap-4 mt-2 mb-4">
                {VEHICLE_OPTIONS.map((option) => {
                    const isSelected = value === option.value;
                    return (
                        <label
                            key={option.value}
                            className={`flex flex-col items-center justify-center p-4 rounded-xl border cursor-pointer select-none transition-all duration-200 group relative ${
                                isSelected
                                    ? "bg-indigo-50 border-indigo-300 text-indigo-700 shadow-sm shadow-indigo-100/50 font-semibold"
                                    : "bg-white border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-700 hover:bg-gray-50/50"
                            } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
                        >
                            <input
                                type="radio"
                                name="vehicle_type"
                                value={option.value}
                                checked={isSelected}
                                onChange={onChange}
                                disabled={disabled}
                                className="sr-only"
                            />
                            <div className={`p-2.5 rounded-lg mb-2 transition-transform duration-200 group-hover:scale-105 ${
                                isSelected ? "bg-indigo-100 text-indigo-650" : "bg-gray-50 text-gray-400 group-hover:text-gray-500"
                            }`}>
                                {option.icon}
                            </div>
                            <span className="text-xs uppercase tracking-wider font-semibold">{option.label}</span>
                        </label>
                    );
                })}
            </div>

            <button
                type="button"
                onClick={onSubmit}
                disabled={submitDisabled}
                className="w-full cursor-pointer rounded-lg py-3.5 px-4 text-xs font-bold uppercase tracking-widest text-white transition-all duration-200 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-indigo-100/60"
            >
                Check in with RFID
            </button>
        </section>
    );
}
