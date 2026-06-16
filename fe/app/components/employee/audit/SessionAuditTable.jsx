"use client";

const STATUS_STYLES = {
    Active: "bg-amber-50 text-amber-700 border border-amber-200",
    Completed: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    "Lost Ticket": "bg-rose-50 text-rose-700 border border-rose-200",
};

function deriveSessionStatus(session) {
    if (session.is_lost) return "Lost Ticket";
    if (session.time_out) return "Completed";
    return "Active";
}

function formatDateTime(dateStr) {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    });
}

const SessionAuditTable = ({ sessions = [], onRowClick }) => {
    if (sessions.length === 0) {
        return (
            <div className="bg-slate-50 border border-dashed border-gray-250 rounded-xl p-12 text-center font-mono my-4">
                <p className="text-slate-400 text-xs uppercase tracking-wider">No sessions match the current filters.</p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-150">
                    <thead className="bg-slate-50/75">
                        <tr>
                            <th className="px-6 py-3.5 text-left text-[10px] font-bold font-mono text-slate-500 uppercase tracking-wider">
                                Session ID
                            </th>
                            <th className="px-6 py-3.5 text-left text-[10px] font-bold font-mono text-slate-500 uppercase tracking-wider">
                                License Plate
                            </th>
                            <th className="px-6 py-3.5 text-left text-[10px] font-bold font-mono text-slate-500 uppercase tracking-wider">
                                Card ID
                            </th>
                            <th className="px-6 py-3.5 text-left text-[10px] font-bold font-mono text-slate-500 uppercase tracking-wider">
                                Vehicle Type
                            </th>
                            <th className="px-6 py-3.5 text-left text-[10px] font-bold font-mono text-slate-500 uppercase tracking-wider">
                                Monthly
                            </th>
                            <th className="px-6 py-3.5 text-left text-[10px] font-bold font-mono text-slate-500 uppercase tracking-wider">
                                Lot Name
                            </th>
                            <th className="px-6 py-3.5 text-left text-[10px] font-bold font-mono text-slate-500 uppercase tracking-wider">
                                Time In
                            </th>
                            <th className="px-6 py-3.5 text-left text-[10px] font-bold font-mono text-slate-500 uppercase tracking-wider">
                                Time Out
                            </th>
                            <th className="px-6 py-3.5 text-left text-[10px] font-bold font-mono text-slate-500 uppercase tracking-wider">
                                Status
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-150">
                        {sessions.map((session) => {
                            const status = session.status || deriveSessionStatus(session);
                            const statusStyle = STATUS_STYLES[status] || "bg-slate-50 text-slate-600 border border-slate-250";

                            return (
                                <tr
                                    key={session.session_id}
                                    onClick={() => onRowClick && onRowClick(session)}
                                    className="hover:bg-indigo-50/20 active:bg-indigo-50/30 cursor-pointer transition-colors"
                                >
                                    <td className="px-6 py-4 whitespace-nowrap text-xs font-bold font-mono text-slate-800">
                                        #{session.session_id}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-xs font-bold font-mono text-slate-800 uppercase">
                                        {session.license_plate || "—"}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-xs font-mono text-slate-600 uppercase">
                                        {session.card_uid || "—"}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-xs font-mono text-slate-600 uppercase">
                                        {session.vehicle_type || "—"}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {session.is_monthly ? (
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-bold font-mono tracking-wider uppercase bg-indigo-50 text-indigo-700 border border-indigo-200">
                                                Monthly
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-bold font-mono tracking-wider uppercase bg-slate-50 text-slate-500 border border-slate-200">
                                                Casual
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-xs font-mono text-slate-600">
                                        {session.lot_name || "—"}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-xs font-mono text-slate-600">
                                        {formatDateTime(session.time_in)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-xs font-mono text-slate-600">
                                        {formatDateTime(session.time_out)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-bold font-mono tracking-wider uppercase ${statusStyle}`}>
                                            {status}
                                        </span>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default SessionAuditTable;
