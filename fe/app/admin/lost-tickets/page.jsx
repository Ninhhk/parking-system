"use client";
import React, { useEffect, useState } from "react";
import DataTable from "../../components/common/DataTable";
import PageHeader from "../../components/common/PageHeader";
import { fetchAllLostTickets, deleteLostTicket } from "../../api/admin.client";

const columns = [
    { key: "reportid", label: "Report ID" },
    { key: "session_id", label: "Session ID" },
    { key: "license_plate", label: "License Plate" },
    { key: "vehicle_type", label: "Vehicle Type" },
    //{ key: "lot_id", label: "Lot ID" },
    //{ key: "time_in", label: "Time In" },
    //{ key: "time_out", label: "Time Out" },
    { key: "penalty_fee", label: "Penalty Fee" },
    //{ key: "guest_phone", label: "Guest Phone" },
];

export default function LostTicketsPage() {
    const [data, setData] = useState([]);
    const [filteredData, setFilteredData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");

    useEffect(() => {
        const fetchLostTickets = async () => {
            try {
                setLoading(true);
                setError(null);
                const data = await fetchAllLostTickets();
                setData(data);
                setFilteredData(data);
                console.log(data);
            } catch (err) {
                setError("Failed to fetch lost tickets");
            } finally {
                setLoading(false);
            }
        };
        fetchLostTickets();
    }, []);

    useEffect(() => {
        if (searchTerm.trim() === "") {
            setFilteredData(data);
            return;
        }
        const term = searchTerm.toLowerCase();
        const filtered = data.filter(
            (ticket) =>
                ticket.reportid?.toString().toLowerCase().includes(term) ||
                ticket.session_id?.toString().toLowerCase().includes(term) ||
                ticket.license_plate?.toLowerCase().includes(term) ||
                ticket.vehicle_type?.toLowerCase().includes(term) ||
                ticket.penalty_fee?.toString().toLowerCase().includes(term)
        );
        setFilteredData(filtered);
    }, [searchTerm, data]);

    const handleSearch = (e) => {
        setSearchTerm(e.target.value);
    };
    const handleDetail = (reportid) => {
        window.location.href = `/admin/lost-tickets/${reportid}`;
    };

    const handleDelete = async (reportid) => {
        if (window.confirm("Are you sure you want to delete this lost ticket report?")) {
            try {
                await deleteLostTicket(reportid);
                setData(data.filter((item) => item.reportid !== reportid));
                setFilteredData(filteredData.filter((item) => item.reportid !== reportid));
            } catch (err) {
                console.error("Failed to delete lost ticket:", err);
                alert("Failed to delete lost ticket report");
            }
        }
    };

    return (
        <div className="p-6">
            <PageHeader title="Lost Ticket Reports" />
            <div className="mt-6 mb-4">
                <div className="flex items-center bg-white border border-gray-300 rounded-lg overflow-hidden shadow-sm">
                    <div className="pl-4 text-gray-500">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-5 w-5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                            />
                        </svg>
                    </div>
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={handleSearch}
                        placeholder="Search by report ID, session ID, license plate, vehicle type..."
                        className="w-full px-4 py-3 text-gray-700 focus:outline-none"
                    />
                    {searchTerm && (
                        <button
                            onClick={() => setSearchTerm("")}
                            className="px-4 text-gray-500 hover:text-gray-700 focus:outline-none"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-5 w-5"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M6 18L18 6M6 6l12 12"
                                />
                            </svg>
                        </button>
                    )}
                </div>
            </div>{" "}
            <div className="mt-2">
                <DataTable
                    columns={columns}
                    data={filteredData}
                    loading={loading}
                    error={error}
                    onDetail={handleDetail}
                    onDelete={handleDelete}
                    idField="reportid"
                />
            </div>
        </div>
    );
}
