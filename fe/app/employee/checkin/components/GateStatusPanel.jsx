export default function GateStatusPanel({ isOpen }) {
    return (
        <section className={`rounded-xl border transition-all duration-300 p-5 shadow-sm ${
            isOpen 
                ? "bg-emerald-50 border-emerald-200 text-emerald-850 shadow-[0_2px_8px_rgba(16,185,129,0.05)]" 
                : "bg-white border-gray-200 text-gray-600"
        }`}>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-lg ${
                        isOpen ? "bg-emerald-100 text-emerald-700" : "bg-gray-50 text-gray-400"
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
                                isOpen ? "bg-emerald-500 animate-pulse" : "bg-rose-500 shadow-xs"
                            }`} />
                            <span className={`text-sm font-bold uppercase tracking-wider ${
                                isOpen ? "text-emerald-700" : "text-rose-600"
                            }`}>
                                {isOpen ? "Gate open" : "Gate closed"}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
