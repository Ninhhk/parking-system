import { useMemo } from "react";

const CARD_UID_REGEX = /^[A-Za-z0-9-]{1,100}$/;

/**
 * Validates a card UID string.
 * Returns true if the value is 1-100 chars of alphanumeric + hyphens.
 */
export function isValidCardUid(value) {
    if (!value || !value.trim()) return false;
    return CARD_UID_REGEX.test(value);
}

export default function ReaderPanel({ value, onChange, disabled, onSubmit }) {
    const isValid = useMemo(() => isValidCardUid(value), [value]);
    const submitDisabled = disabled || !isValid;

    function handleKeyDown(e) {
        if (e.key === "Enter") {
            e.preventDefault();
            if (!submitDisabled && onSubmit) {
                onSubmit();
            }
        }
    }

    return (
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3 border-b border-gray-250/60 pb-3 mb-4">
                <div className="p-2 rounded bg-indigo-50 text-indigo-600">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <rect x="3" y="4" width="18" height="16" rx="2" strokeWidth={2} />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h10M7 16h4" />
                    </svg>
                </div>
                <div>
                    <h2 className="text-sm font-semibold text-slate-800 uppercase tracking-wider">RFID Reader Terminal</h2>
                    <p className="text-xs text-slate-500">Scan card or enter UID manually below</p>
                </div>
            </div>

            <div className="bg-gray-50/50 p-4 rounded-lg border border-gray-200/80 mb-4">
                <div className="w-full">
                    <label htmlFor="rfid-card-uid" className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                        RFID Card UID
                    </label>
                    <div className="relative">
                        <input
                             id="rfid-card-uid"
                             name="card_uid"
                             type="text"
                             value={value}
                             onChange={onChange}
                             onKeyDown={handleKeyDown}
                             disabled={disabled}
                             required
                             maxLength={100}
                             className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-lg font-mono font-bold tracking-widest text-slate-800 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 shadow-inner placeholder-gray-300 transition-all text-center md:text-left disabled:opacity-50"
                             placeholder="CARD-0000"
                        />
                        <div className="absolute right-3 top-3.5 flex items-center gap-1.5 pointer-events-none">
                            <span className={`w-2 h-2 rounded-full ${isValid ? "bg-emerald-500 animate-pulse" : "bg-gray-300"}`} />
                            <span className={`text-[9px] font-mono font-bold uppercase ${isValid ? "text-emerald-600" : "text-gray-400"}`}>
                                {isValid ? "Ready" : "Waiting"}
                            </span>
                        </div>
                    </div>
                    {value && !isValid && (
                        <p className="mt-1.5 text-[10px] font-mono text-rose-500">
                            Invalid UID — only alphanumeric characters and hyphens (1-100 chars)
                        </p>
                    )}
                </div>
            </div>
        </section>
    );
}
