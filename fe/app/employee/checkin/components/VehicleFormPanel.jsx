export default function VehicleFormPanel({ onSelect, disabled }) {
    return (
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3 border-b border-gray-200 pb-3 mb-4">
                <div className="p-2 rounded bg-indigo-50 text-indigo-600">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                    </svg>
                </div>
                <div>
                    <h2 className="text-sm font-semibold text-slate-800 uppercase tracking-wider">Vehicle Type</h2>
                    <p className="text-xs text-slate-500">Select vehicle type for this entry</p>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <button
                    type="button"
                    onClick={() => onSelect("car")}
                    disabled={disabled}
                    className="flex flex-col items-center justify-center p-6 rounded-xl border border-gray-200 bg-white cursor-pointer select-none transition-all duration-200 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 hover:shadow-sm active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed text-gray-600"
                >
                    <span className="text-4xl mb-2">🚗</span>
                    <span className="text-xs uppercase tracking-wider font-semibold">Car</span>
                </button>

                <button
                    type="button"
                    onClick={() => onSelect("bike")}
                    disabled={disabled}
                    className="flex flex-col items-center justify-center p-6 rounded-xl border border-gray-200 bg-white cursor-pointer select-none transition-all duration-200 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 hover:shadow-sm active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed text-gray-600"
                >
                    <span className="text-4xl mb-2">🏍️</span>
                    <span className="text-xs uppercase tracking-wider font-semibold">Bike</span>
                </button>
            </div>
        </section>
    );
}
