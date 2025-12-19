"use client";

import { useState, useEffect } from "react";
import { fetchActiveSessions } from "../../api/employee.client";
import { useToast } from "../../components/providers/ToastProvider";
import PageHeader from "../../components/common/PageHeader";
import { useRouter } from "next/navigation";
import DataTable from "../../components/common/DataTable";
import { FaSearch, FaTimes } from "react-icons/fa";

export default function CheckOutPage() {
    const toast = useToast();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [activeSessions, setActiveSessions] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [lastRefreshed, setLastRefreshed] = useState(Date.now());

    useEffect(() => {
        loadActiveSessions();
    }, [lastRefreshed]);

    const loadActiveSessions = async () => {
        setLoading(true);
        try {
            const data = await fetchActiveSessions();
            setActiveSessions(data.sessions || []);
        } catch (error) {
            toast.error(error.response?.data?.message || "Failed to load sessions");
        } finally {
            setLoading(false);
        }
    };

    const clearSearch = () => {
        setSearchTerm("");
    };

    // DataTable columns and formatting
    const columns = [
        { key: "session_id", label: "Ticket ID" },
        { key: "license_plate", label: "License Plate" },
        { key: "vehicle_type", label: "Vehicle" },
        { key: "time_in", label: "Check-In Time" },
        { key: "is_monthly", label: "Monthly" },
        { key: "is_lost", label: "Is Lost" },
    ];

    const formatDateTime = (dateStr) => {
        if (!dateStr) return "N/A";
        const date = new Date(dateStr);
        return date.toLocaleString();
    };

    const formatSessions = (sessions) =>
        sessions
            .filter((session) => session.license_plate.toLowerCase().includes(searchTerm.toLowerCase()))
            .map((s) => ({
                ...s,
                vehicle_type: s.vehicle_type.charAt(0).toUpperCase() + s.vehicle_type.slice(1),
                time_in: formatDateTime(s.time_in),
                is_monthly: s.is_monthly ? (
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                        Yes
                    </span>
                ) : (
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                        No
                    </span>
                ),
                is_lost: s.is_lost ? (
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-700">
                        Yes
                    </span>
                ) : (
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                        No
                    </span>
                ),
            }));

    const handleDetail = (sessionId) => {
        router.push(`/employee/checkout/${sessionId}`);
    };

    return (
        <div className="container mx-auto p-6">
            <PageHeader title="Check-Out Vehicle" />
            <div className="mb-6 max-w-2xl relative">
                <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <FaSearch className="h-4 w-4 text-gray-400" />
                    </span>
                    {searchTerm && (
                        <button onClick={clearSearch} className="absolute inset-y-0 right-0 pr-3 flex items-center">
                            <FaTimes className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                        </button>
                    )}
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search by license plate..."
                        className="block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                    />
                </div>
            </div>
            <DataTable
                columns={columns}
                data={formatSessions(activeSessions)}
                loading={loading}
                onDetail={handleDetail}
                idField="session_id"
            />
        </div>
    );
}
