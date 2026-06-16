"use client";

import { useEffect, useState, useCallback } from "react";
import FilterBar from "@/app/components/employee/audit/FilterBar";
import SessionAuditTable from "@/app/components/employee/audit/SessionAuditTable";
import SessionDetailModal from "@/app/components/employee/audit/SessionDetailModal";
import { fetchAdminAuditSessions, fetchParkingLots } from "@/app/api/admin.client";
import PageHeader from "@/app/components/admin/PageHeader";

const DEFAULT_PAGE_SIZE = 20;

export default function AdminAuditPage() {
    const [filters, setFilters] = useState({});
    const [page, setPage] = useState(1);
    const [sessions, setSessions] = useState([]);
    const [pagination, setPagination] = useState({ page: 1, pageSize: DEFAULT_PAGE_SIZE, totalCount: 0, totalPages: 0 });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [selectedSession, setSelectedSession] = useState(null);
    const [lots, setLots] = useState([]);

    useEffect(() => {
        fetchParkingLots()
            .then(setLots)
            .catch(() => setLots([]));
    }, []);

    const loadSessions = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await fetchAdminAuditSessions({ ...filters, page, pageSize: DEFAULT_PAGE_SIZE });
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

    return (
        <>
            <PageHeader title="Session Audit" />

            <FilterBar onSearch={handleSearch} onReset={handleReset} lots={lots} />

            {error && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-lg mb-4 text-sm">
                    {error}
                </div>
            )}

            {loading ? (
                <div className="flex justify-center items-center py-20">
                    <div className="text-sm text-gray-500">Loading...</div>
                </div>
            ) : (
                <SessionAuditTable sessions={sessions} onRowClick={setSelectedSession} />
            )}

            {!loading && pagination.totalCount > 0 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
                    <span className="text-sm text-gray-500">
                        {pagination.totalCount} record(s)
                    </span>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={page <= 1}
                            className="px-3 py-1.5 text-sm border border-gray-200 rounded-md bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Previous
                        </button>
                        <span className="text-sm text-gray-600">
                            Page {pagination.page} of {pagination.totalPages}
                        </span>
                        <button
                            onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                            disabled={page >= pagination.totalPages}
                            className="px-3 py-1.5 text-sm border border-gray-200 rounded-md bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
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
