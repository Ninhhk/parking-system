export default function ResultPanel({ stateLabel, detail, sessionId }) {
    // Determine the style theme based on the current state label
    let themeClass = "bg-white border-gray-200 text-slate-500";
    let iconColor = "text-slate-400";
    let badge = null;

    if (stateLabel === "Access granted") {
        themeClass = "bg-emerald-50 border-emerald-200 text-emerald-850 shadow-[0_2px_8px_rgba(16,185,129,0.05)]";
        iconColor = "text-emerald-500";
        badge = (
            <span className="text-[10px] font-bold font-mono tracking-widest px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 border border-emerald-200 uppercase">
                PASSED
            </span>
        );
    } else if (stateLabel === "Access denied") {
        themeClass = "bg-rose-50 border-rose-200 text-rose-850 shadow-[0_2px_8px_rgba(244,63,94,0.05)]";
        iconColor = "text-rose-500";
        badge = (
            <span className="text-[10px] font-bold font-mono tracking-widest px-2 py-0.5 rounded bg-rose-100 text-rose-700 border border-rose-200 uppercase">
                REJECTED
            </span>
        );
    } else if (stateLabel === "System error") {
        themeClass = "bg-rose-50 border-rose-200 text-rose-850";
        iconColor = "text-rose-500";
        badge = (
            <span className="text-[10px] font-bold font-mono tracking-widest px-2 py-0.5 rounded bg-rose-100 text-rose-700 border border-rose-200 uppercase">
                ERROR
            </span>
        );
    } else if (stateLabel === "Scanning card...") {
        themeClass = "bg-blue-50 border-blue-200 text-blue-850 shadow-[0_2px_8px_rgba(14,165,233,0.05)]";
        iconColor = "text-blue-500";
        badge = (
            <span className="text-[10px] font-bold font-mono tracking-widest px-2 py-0.5 rounded bg-blue-100 text-blue-700 border border-blue-200 uppercase animate-pulse">
                SCANNING
            </span>
        );
    }

    return (
        <section className={`rounded-xl border p-5 shadow-sm transition-all duration-300 ${themeClass}`}>
            <div className="flex items-center justify-between border-b border-gray-150 pb-3 mb-3">
                <div className="flex items-center gap-2">
                    <svg className={`w-5 h-5 ${iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-800">Terminal Readout</h2>
                </div>
                {badge}
            </div>

            <div className="bg-gray-50/80 rounded-lg p-4 font-mono text-xs border border-gray-200/80 space-y-2 relative shadow-inner">
                <div className="flex justify-between items-start gap-4">
                    <span className="text-slate-500 uppercase tracking-widest text-[9px]">Status:</span>
                    <span className="font-bold text-right text-slate-800">{stateLabel}</span>
                </div>
                
                <div className="flex justify-between items-start gap-4 border-t border-gray-200/60 pt-2">
                    <span className="text-slate-500 uppercase tracking-widest text-[9px]">Message:</span>
                    <span className="text-right text-slate-650">{detail || "Awaiting next action."}</span>
                </div>

                {sessionId && (
                    <div className="flex justify-between items-center border-t border-gray-200/60 pt-2 text-indigo-600">
                        <span className="text-slate-500 uppercase tracking-widest text-[9px]">Session Token:</span>
                        <span className="font-bold tracking-wider text-indigo-700">Session #{sessionId}</span>
                    </div>
                )}
            </div>
        </section>
    );
}
