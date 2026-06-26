"use client";

import { useEffect, useState, useCallback } from "react";
import SessionAuditTable from "@/app/components/employee/audit/SessionAuditTable";
import SessionDetailModal from "@/app/components/employee/audit/SessionDetailModal";
import { fetchAdminAuditSessions } from "@/app/api/admin.client";
import PageHeader from "@/app/components/admin/PageHeader";

const DEFAULT_PAGE_SIZE = 20;

export default function AdminAuditPage() {
    const [searchTerm, setSearchTerm] = useState("");
    const [status, setStatus] = useState("");
    const [page, setPage] = useState(1);
    const [sessions, setSessions] = useState([]);
    const [pagination, setPagination] = useState({ page: 1, pageSize: DEFAULT_PAGE_SIZE, totalCount: 0, totalPages: 0 });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [selectedSession, setSelectedSession] = useState(null);

    const loadSessions = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params = { page, pageSize: DEFAULT_PAGE_SIZE };
            if (searchTerm.trim()) params.q = searchTerm.trim();
            if (status) params.status = status;
            const data = await fetchAdminAuditSessions(params);
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
    }, [searchTerm, status, page]);

    useEffect(() => {
        loadSessions();
    }, [loadSessions]);

    const handleSearchChange = (e) => {
        setSearchTerm(e.target.value);
        setPage(1);
    };

    const handleStatusChange = (e) => {
        setStatus(e.target.value);
        setPage(1);
    };

    return (
        <>
            <PageHeader title="Session Audit" />

            {/* Search + Status filter */}
            <div className="mb-6 flex flex-wrap items-center gap-4">
                <div className="relative w-80">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                        <svg className="w-4 h-4 text-slate-500" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 20">
                            <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m19 19-4-4m0-7A7 7 0 1 1 1 8a7 7 0 0 1 14 0Z"/>
                        </svg>
                    </div>
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={handleSearchChange}
                        placeholder="Search by plate, session, card, lot..."
                        className="block w-full p-3 pl-10 text-sm text-slate-800 border border-slate-200 rounded-lg bg-white focus:ring-indigo-500 focus:border-indigo-500"
                    />
                    {searchTerm && (
                        <button
                            onClick={() => { setSearchTerm(""); setPage(1); }}
                            className="absolute inset-y-0 right-0 pr-3 flex items-center"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400 hover:text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    )}
                </div>
                <select
                    value={status}
                    onChange={handleStatusChange}
                    className="border border-slate-200 rounded-lg px-3 py-3 text-sm bg-white focus:ring-indigo-500 focus:border-indigo-500"
                >
                    <option value="">All Statuses</option>
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                    <option value="lost_ticket">Lost Ticket</option>
                </select>
            </div>

            {error && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-lg mb-4 text-sm">
                    {error}
                </div>
            )}

            {loading ? (
                <div className="flex justify-center items-center py-20">
                    <div className="text-sm text-slate-500">Loading...</div>
                </div>
            ) : (
                <SessionAuditTable sessions={sessions} onRowClick={setSelectedSession} />
            )}

            {!loading && pagination.totalCount > 0 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-200">
                    <span className="text-sm text-slate-500">
                        {pagination.totalCount} record(s)
                    </span>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={page <= 1}
                            className="px-3 py-1.5 text-sm border border-slate-200 rounded-md bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Previous
                        </button>
                        <span className="text-sm text-slate-600">
                            Page {pagination.page} of {pagination.totalPages}
                        </span>
                        <button
                            onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                            disabled={page >= pagination.totalPages}
                            className="px-3 py-1.5 text-sm border border-slate-200 rounded-md bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}

            <SessionDetailModal session={selectedSession} onClose={() => setSelectedSession(null)} />
        </>
    );
}
