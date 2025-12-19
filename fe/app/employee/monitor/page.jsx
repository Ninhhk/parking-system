"use client";

import { useEffect, useState } from "react";
import { fetchMyLot, fetchMyParkingSessions } from "../../api/employee.client";
import { FaParking, FaCar, FaMotorcycle, FaClipboardList, FaSync, FaExclamationCircle } from "react-icons/fa";

// LotStatCard component to display stat in a styled card
function LotStatCard({ title, value, icon, color }) {
    return (
        <div className="bg-white rounded-lg shadow-md p-4 flex items-center">
            <div className={`rounded-full p-3 mr-4 ${color}`}>{icon}</div>
            <div>
                <p className="text-sm text-gray-500">{title}</p>
                <p className="text-2xl font-bold">{value}</p>
            </div>
        </div>
    );
}

// CapacityBar component to visualize capacity
function CapacityBar({ current, max, type }) {
    const percentage = Math.min(100, Math.round((current / max) * 100));
    const getColor = () => {
        if (percentage < 60) return "bg-green-500";
        if (percentage < 85) return "bg-yellow-500";
        return "bg-red-500";
    };

    return (
        <div className="mb-4">
            <div className="flex justify-between mb-1">
                <span className="text-sm font-medium text-gray-700 capitalize">{type} Capacity</span>
                <span className="text-sm font-medium text-gray-700">
                    {current} / {max}
                </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div className={`h-2.5 rounded-full ${getColor()}`} style={{ width: `${percentage}%` }}></div>
            </div>
        </div>
    );
}

// LotStatus component to display lot information
function LotStatus({ lot, loading }) {
    if (!lot) return null;

    return (
        <div className="bg-white shadow-md rounded-lg overflow-hidden mb-6">
            <div className="bg-blue-600 text-white px-6 py-4">
                <div className="flex justify-between items-center">
                    <h2 className="text-xl font-semibold flex items-center">
                        <FaParking className="mr-2" />
                        {lot.lot_name} - Status
                    </h2>
                    {/* Removing refresh button as requested
                    <button
                        onClick={() => fetchData()}
                        disabled={loading}
                        className="text-white hover:bg-blue-700 rounded-full p-2 transition-colors"
                    >
                        <FaSync className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                    </button>
                    */}
                </div>
            </div>
            <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div className="space-y-4">
                        <CapacityBar current={lot.current_car} max={lot.car_capacity} type="car" />
                        <CapacityBar current={lot.current_bike} max={lot.bike_capacity} type="bike" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <LotStatCard
                            title="Cars Available"
                            value={lot.car_capacity - lot.current_car}
                            icon={<FaCar className="h-5 w-5 text-blue-500" />}
                            color="bg-blue-100"
                        />
                        <LotStatCard
                            title="Bikes Available"
                            value={lot.bike_capacity - lot.current_bike}
                            icon={<FaMotorcycle className="h-5 w-5 text-green-500" />}
                            color="bg-green-100"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}

// Sessions table component
function ActiveSessionsTable({ sessions }) {
    return (
        <div className="bg-white shadow-md rounded-lg overflow-hidden">
            <div className="bg-blue-600 text-white px-6 py-4 flex justify-between items-center">
                <h2 className="text-xl font-semibold flex items-center">
                    <FaClipboardList className="mr-2" />
                    Active Parking Sessions
                </h2>
                <span className="bg-white text-blue-600 rounded-full px-3 py-1 text-sm font-semibold">
                    {sessions.length} vehicles
                </span>
            </div>
            <div className="p-6">
                {sessions.length === 0 ? (
                    <div className="text-center py-8">
                        <p className="text-gray-500">No active parking sessions</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto shadow-sm rounded-lg border border-gray-200">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th
                                        scope="col"
                                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                                    >
                                        Session ID
                                    </th>
                                    <th
                                        scope="col"
                                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                                    >
                                        Vehicle Type
                                    </th>
                                    <th
                                        scope="col"
                                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                                    >
                                        License Plate
                                    </th>
                                    <th
                                        scope="col"
                                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                                    >
                                        Time In
                                    </th>
                                    <th
                                        scope="col"
                                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                                    >
                                        Monthly Pass
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {sessions.map((session) => (
                                    <tr key={session.session_id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                            {session.session_id}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">
                                            <span className="flex items-center">
                                                {session.vehicle_type === "car" ? (
                                                    <FaCar className="mr-2 text-blue-500" />
                                                ) : (
                                                    <FaMotorcycle className="mr-2 text-green-500" />
                                                )}
                                                {session.vehicle_type}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {session.license_plate}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {new Date(session.time_in).toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                            {session.is_monthly ? (
                                                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                                    Yes
                                                </span>
                                            ) : (
                                                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                                                    No
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

// Main page component
export default function LotMonitorPage() {
    const [lot, setLot] = useState(null);
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    async function fetchData() {
        setLoading(true);
        setError(null);

        try {
            const [lotData, sessionData] = await Promise.all([fetchMyLot(), fetchMyParkingSessions()]);
            setLot(lotData);
            setSessions(sessionData);
        } catch (err) {
            console.error("Error fetching data:", err);
            setError("Failed to load data. Please try again later.");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        fetchData();
        // Refresh data every 30 seconds
        const interval = setInterval(fetchData, 30000);
        return () => clearInterval(interval);
    }, []);

    if (loading && !lot) {
        return (
            <div className="flex justify-center items-center h-screen bg-gray-100">
                <div className="text-center">
                    <FaSync className="animate-spin h-8 w-8 text-blue-600 mx-auto mb-4" />
                    <p className="text-gray-600">Loading parking lot data...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex justify-center items-center h-screen bg-gray-100">
                <div className="text-center max-w-md bg-white p-8 rounded-lg shadow-md">
                    <FaExclamationCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-gray-800 mb-2">Error</h2>
                    <p className="text-gray-600 mb-4">{error}</p>
                    <button
                        onClick={fetchData}
                        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
                    >
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    if (!lot) {
        return (
            <div className="flex justify-center items-center h-screen bg-gray-100">
                <div className="text-center max-w-md bg-white p-8 rounded-lg shadow-md">
                    <FaExclamationCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-gray-800 mb-2">No Lot Assigned</h2>
                    <p className="text-gray-600">You are not currently assigned to manage any parking lot.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 bg-gray-100 min-h-screen">
            <LotStatus lot={lot} loading={loading} />
            <ActiveSessionsTable sessions={sessions} />
        </div>
    );
}
