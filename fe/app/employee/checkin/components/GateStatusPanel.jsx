export default function GateStatusPanel({ isOpen, isHoldMode, onManualOpen, onHoldOpen, onManualClose }) {
    return (
        <section className={`rounded-xl border transition-all duration-300 p-5 shadow-sm ${
            isOpen && isHoldMode
                ? "bg-amber-50 border-amber-200 text-amber-850 shadow-[0_2px_8px_rgba(245,158,11,0.05)]"
                : isOpen 
                    ? "bg-emerald-50 border-emerald-200 text-emerald-850 shadow-[0_2px_8px_rgba(16,185,129,0.05)]" 
                    : "bg-white border-gray-200 text-gray-600"
        }`}>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-lg ${
                        isOpen && isHoldMode
                            ? "bg-amber-100 text-amber-700"
                            : isOpen ? "bg-emerald-100 text-emerald-700" : "bg-gray-50 text-gray-400"
                    }`}>
                        {isOpen ? (
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 11l3-3m0 0l3 3m-3-3v8m0-13a9 9 0 110 18 9 9 0 010-18z" />
                            </svg>
                        ) : (
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        )}
                    </div>
                    <div>
                        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 font-mono">Barrier Gate</h2>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <span className={`w-2.5 h-2.5 rounded-full ${
                                isOpen && isHoldMode
                                    ? "bg-amber-500 animate-pulse"
                                    : isOpen ? "bg-emerald-500 animate-pulse" : "bg-rose-500 shadow-xs"
                            }`} />
                            <span className={`text-sm font-bold uppercase tracking-wider ${
                                isOpen && isHoldMode
                                    ? "text-amber-700"
                                    : isOpen ? "text-emerald-700" : "text-rose-600"
                            }`}>
                                {isOpen ? "Gate open" : "Gate closed"}
                            </span>
                            {isOpen && isHoldMode && (
                                <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded bg-amber-200 text-amber-800">
                                    HOLD
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={onManualOpen}
                        className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 hover:border-gray-400 hover:text-gray-800 transition-all duration-200 cursor-pointer active:scale-[0.97] shadow-sm"
                    >
                        Manual Open
                    </button>
                    {onHoldOpen && (
                        <button
                            type="button"
                            onClick={onHoldOpen}
                            className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-lg border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:border-amber-400 hover:text-amber-800 transition-all duration-200 cursor-pointer active:scale-[0.97] shadow-sm"
                        >
                            Hold Open
                        </button>
                    )}
                    {isOpen && onManualClose && (
                        <button
                            type="button"
                            onClick={onManualClose}
                            className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-lg border border-rose-300 bg-white text-rose-600 hover:bg-rose-50 hover:border-rose-400 hover:text-rose-800 transition-all duration-200 cursor-pointer active:scale-[0.97] shadow-sm"
                        >
                            Manual Close
                        </button>
                    )}
                </div>
            </div>
        </section>
    );
}
