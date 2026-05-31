export default function CasualEntryControl({ onTrigger, disabled }) {
    return (
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <button
                type="button"
                onClick={onTrigger}
                disabled={disabled}
                className="w-full cursor-pointer rounded-xl py-5 px-6 text-center transition-all duration-200 bg-amber-500 hover:bg-amber-600 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-amber-100/60 border border-amber-400"
            >
                <span className="block text-lg font-bold text-white tracking-wide">
                    Khách vãng lai
                </span>
                <span className="block text-xs text-amber-100 mt-1 uppercase tracking-wider">
                    Casual entry
                </span>
            </button>
        </section>
    );
}
