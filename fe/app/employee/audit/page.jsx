"use client";

import { useEffect, useState, useCallback } from "react";
import FilterBar from "@/app/components/employee/audit/FilterBar";
import SessionAuditTable from "@/app/components/employee/audit/SessionAuditTable";
import SessionDetailModal from "@/app/components/employee/audit/SessionDetailModal";
import { fetchAuditSessions } from "@/app/api/employee.audit.client";
import { fetchParkingLots } from "@/app/api/employee.client";

const DEFAULT_PAGE_SIZE = 20;

export default function AuditPage() {
    const [filters, setFilters] = useState({});
    const [page, setPage] = useState(1);
    const [sessions, setSessions] = useState([]);
    const [pagination, setPagination] = useState({ page: 1, pageSize: DEFAULT_PAGE_SIZE, totalCount: 0, totalPages: 0 });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [selectedSession, setSelectedSession] = useState(null);
    const [lots, setLots] = useState([]);
    const [currentTime, setCurrentTime] = useState("");

    // Clock effect matching the RFID kiosk page
    useEffect(() => {
        const updateClock = () => {
            const now = new Date();
            setCurrentTime(now.toLocaleTimeString("en-US", { hour12: false }));
        };
        updateClock();
        const timer = setInterval(updateClock, 1000);
        return () => clearInterval(timer);
    }, []);

    // Fetch parking lots for the filter dropdown
    useEffect(() => {
        fetchParkingLots()
            .then(setLots)
            .catch(() => setLots([]));
    }, []);

    // Fetch sessions when filters or page change
    const loadSessions = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await fetchAuditSessions({ ...filters, page, pageSize: DEFAULT_PAGE_SIZE });
            setSessions(data.sessions || []);
            setPagination(data.pagination || { page: 1, pageSize: DEFAULT_PAGE_SIZE, totalCount: 0, totalPages: 0 });
        } catch (err) {
            const message = err.response?.data?.message || "Failed to fetch sessions";
            setError(message);
            setSessions([]);
            setPagination({ page: 1, pageSize: DEFAULT_PAGE_SIZE, totalCount: 0, totalPages: 0 });
        } finally {
            setLoading(false);
        }
    }, [filters, page]);

    useEffect(() => {
        loadSessions();
    }, [loadSessions]);

    const handleSearch = (activeFilters) => {
        setFilters(activeFilters);
        setPage(1);
    };

    const handleReset = () => {
        setFilters({});
        setPage(1);
    };

    const handlePrevPage = () => {
        if (page > 1) setPage(page - 1);
    };

    const handleNextPage = () => {
        if (page < pagination.totalPages) setPage(page + 1);
    };

    return (
        <main className="mx-auto max-w-6xl p-6 bg-white text-slate-800 rounded-2xl border border-gray-200 shadow-xs my-4 w-full">
            {/* Corporate Header bar matching RFID kiosk */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-gray-150 pb-4 mb-6 gap-3">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-pulse" />
                        <h1 className="text-xl font-bold uppercase tracking-wider text-slate-900 font-mono">
                            Session Audit Logs
                        </h1>
                    </div>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">VEHICLE TRANSACTION HISTORY & AUDIT TRAIL</p>
                </div>

                <div className="flex items-center gap-4 text-xs font-mono">
                    <div className="bg-gray-50 border border-gray-200 px-3 py-1.5 rounded flex items-center gap-2 text-slate-600 shadow-xs">
                        <span className="text-slate-400 uppercase tracking-widest text-[9px]">CLOCK:</span>
                        <span className="font-bold text-indigo-600 tracking-widest">{currentTime || "00:00:00"}</span>
                    </div>
                </div>
            </header>

            <FilterBar onSearch={handleSearch} onReset={handleReset} lots={lots} />

            {error && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl mb-6 text-sm font-mono flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                    {error}
                </div>
            )}

            {loading ? (
                <div className="flex flex-col justify-center items-center py-20 gap-3">
                    <div className="w-8 h-8 rounded-full border-2 border-indigo-100 border-t-indigo-600 animate-spin" />
                    <p className="text-xs font-mono text-slate-400 tracking-wider">RETRIEVING TRANSACTION DATA...</p>
                </div>
            ) : (
                <SessionAuditTable sessions={sessions} onRowClick={setSelectedSession} />
            )}

            {/* Pagination controls */}
            {!loading && pagination.totalCount > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between mt-6 pt-4 border-t border-gray-150 gap-4">
                    <span className="text-xs text-slate-500 font-mono">
                        TOTAL: <span className="font-bold text-slate-700">{pagination.totalCount}</span> RECORD(S)
                    </span>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handlePrevPage}
                            disabled={page <= 1}
                            className="cursor-pointer px-3 py-1.5 text-xs font-mono font-bold tracking-wider uppercase border border-gray-200 rounded-lg bg-gray-50 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-slate-600"
                        >
                            Previous
                        </button>
                        <span className="text-xs font-mono text-slate-600 font-bold bg-indigo-50/50 border border-indigo-100 px-3 py-1.5 rounded-lg">
                            PAGE {pagination.page} OF {pagination.totalPages}
                        </span>
                        <button
                            onClick={handleNextPage}
                            disabled={page >= pagination.totalPages}
                            className="cursor-pointer px-3 py-1.5 text-xs font-mono font-bold tracking-wider uppercase border border-gray-200 rounded-lg bg-gray-50 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-slate-600"
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}

            <SessionDetailModal session={selectedSession} onClose={() => setSelectedSession(null)} />
        </main>
    );
}
