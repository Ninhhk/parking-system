"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { fetchActiveVehicles } from "@/app/api/employee.client";
import SessionAuditTable from "@/app/components/employee/audit/SessionAuditTable";
import SessionDetailModal from "@/app/components/employee/audit/SessionDetailModal";

const PAGE_SIZE = 20;

export default function VehiclesInLotPage() {
    const [sessions, setSessions] = useState([]);
    const [pagination, setPagination] = useState({ page: 1, pageSize: PAGE_SIZE, totalCount: 0, totalPages: 0 });
    const [page, setPage] = useState(1);
    const [plateQuery, setPlateQuery] = useState("");
    const [searchPlate, setSearchPlate] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [selectedSession, setSelectedSession] = useState(null);
    const router = useRouter();

    const handleProcess = (session) => {
        router.push(`/employee/checkout?session_id=${session.session_id}`);
    };

    const loadVehicles = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await fetchActiveVehicles({
                plate: searchPlate || undefined,
                page,
                pageSize: PAGE_SIZE,
            });
            setSessions(data.sessions || []);
            setPagination(data.pagination || { page: 1, pageSize: PAGE_SIZE, totalCount: 0, totalPages: 0 });
        } catch (err) {
            const message = err.response?.data?.message || "Failed to fetch vehicles";
            setError(message);
            setSessions([]);
        } finally {
            setLoading(false);
        }
    }, [searchPlate, page]);

    useEffect(() => {
        loadVehicles();
    }, [loadVehicles]);

    const handleSearch = (e) => {
        e.preventDefault();
        setSearchPlate(plateQuery.trim());
        setPage(1);
    };

    const handleClear = () => {
        setPlateQuery("");
        setSearchPlate("");
        setPage(1);
    };

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h1 className="text-lg font-bold text-slate-900 font-mono tracking-wide uppercase">
                        Vehicles In Lot
                    </h1>
                    <p className="text-xs text-slate-500 mt-0.5">
                        Currently parked vehicles ({pagination.totalCount})
                    </p>
                </div>

                {/* Search */}
                <form onSubmit={handleSearch} className="flex items-center gap-2">
                    <input
                        type="text"
                        value={plateQuery}
                        onChange={(e) => setPlateQuery(e.target.value)}
                        placeholder="Search plate..."
                        className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 w-40 font-mono uppercase"
                        maxLength={20}
                    />
                    <button
                        type="submit"
                        className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                        Search
                    </button>
                    {searchPlate && (
                        <button
                            type="button"
                            onClick={handleClear}
                            className="px-3 py-1.5 text-xs font-semibold border border-gray-200 bg-white text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                            Clear
                        </button>
                    )}
                </form>
            </div>

            {/* Error */}
            {error && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-lg text-sm">
                    {error}
                </div>
            )}

            {/* Table */}
            {loading ? (
                <div className="flex justify-center items-center py-20">
                    <div className="text-sm text-gray-500">Loading...</div>
                </div>
            ) : (
                <SessionAuditTable sessions={sessions} onRowClick={setSelectedSession} />
            )}

            {/* Pagination */}
            {!loading && pagination.totalCount > 0 && (
                <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                    <span className="text-sm text-gray-500">
                        {pagination.totalCount} vehicle(s)
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

            {/* Detail modal */}
            <SessionDetailModal session={selectedSession} onClose={() => setSelectedSession(null)} onProcess={handleProcess} />
        </div>
    );
}
