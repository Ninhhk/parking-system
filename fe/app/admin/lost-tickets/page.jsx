"use client";

import { useEffect, useState, useCallback } from "react";
import DataTable from "../../components/common/DataTable";
import PageHeader from "../../components/common/PageHeader";
import { fetchAllLostTickets, deleteLostTicket } from "../../api/admin.client";

const DEFAULT_PAGE_SIZE = 20;

const columns = [
    { key: "reportid", label: "Report ID" },
    { key: "session_id", label: "Session ID" },
    { key: "license_plate", label: "License Plate" },
    { key: "vehicle_type", label: "Vehicle Type" },
    { key: "penalty_fee", label: "Penalty Fee" },
];

export default function LostTicketsPage() {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState({ page: 1, pageSize: DEFAULT_PAGE_SIZE, totalCount: 0, totalPages: 0 });

    const loadData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await fetchAllLostTickets({ page, pageSize: DEFAULT_PAGE_SIZE, q: searchTerm });
            setData(result.reports || []);
            setPagination(result.pagination || { page: 1, pageSize: DEFAULT_PAGE_SIZE, totalCount: 0, totalPages: 0 });
        } catch (err) {
            setError("Failed to fetch lost tickets");
        } finally {
            setLoading(false);
        }
    }, [page, searchTerm]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleSearch = (e) => {
        setSearchTerm(e.target.value);
        setPage(1);
    };

    const handleDetail = (reportid) => {
        window.location.href = `/admin/lost-tickets/${reportid}`;
    };

    const handleDelete = async (reportid) => {
        if (!window.confirm("Are you sure you want to delete this lost ticket report?")) return;
        try {
            await deleteLostTicket(reportid);
            await loadData();
        } catch (err) {
            console.error("Failed to delete lost ticket:", err);
            alert("Failed to delete lost ticket report");
        }
    };

    return (
        <div className="p-6">
            <PageHeader title="Lost Ticket Reports" />
            <div className="mt-6 mb-4">
                <div className="flex items-center bg-white border border-gray-300 rounded-lg overflow-hidden shadow-sm w-80">
                    <div className="pl-4 text-gray-500">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={handleSearch}
                        placeholder="Search plate, session ID, phone..."
                        className="w-full px-4 py-3 text-gray-700 focus:outline-none text-sm"
                    />
                    {searchTerm && (
                        <button onClick={() => { setSearchTerm(""); setPage(1); }} className="px-4 text-gray-500 hover:text-gray-700">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    )}
                </div>
            </div>

            <div className="mt-2">
                <DataTable
                    columns={columns}
                    data={data}
                    loading={loading}
                    error={error}
                    onDetail={handleDetail}
                    onDelete={handleDelete}
                    idField="reportid"
                />
            </div>

            {/* Pagination */}
            {!loading && pagination.totalCount > 0 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
                    <span className="text-sm text-gray-500">
                        {pagination.totalCount} report(s)
                    </span>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setPage(Math.max(1, page - 1))}
                            disabled={page <= 1}
                            className="px-3 py-1.5 text-sm border border-gray-200 rounded-md bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Previous
                        </button>
                        <span className="text-sm text-gray-600">
                            Page {pagination.page} of {pagination.totalPages}
                        </span>
                        <button
                            onClick={() => setPage(Math.min(pagination.totalPages, page + 1))}
                            disabled={page >= pagination.totalPages}
                            className="px-3 py-1.5 text-sm border border-gray-200 rounded-md bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
