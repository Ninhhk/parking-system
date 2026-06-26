"use client";

import { useEffect, useState } from "react";
import { fetchMyLot } from "../api/employee.client";
import api from "../api/client.config";
import { FaCar, FaMotorcycle, FaExclamationTriangle } from "react-icons/fa";

function CapacityBar({ current, max, type, icon }) {
    const percentage = max > 0 ? Math.min(100, Math.round((current / max) * 100)) : 0;
    const available = max - current;
    const getColor = () => {
        if (percentage < 60) return "bg-green-500";
        if (percentage < 85) return "bg-yellow-500";
        return "bg-red-500";
    };

    return (
        <div className="mb-4">
            <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-medium text-gray-700 flex items-center gap-1">
                    {icon}
                    <span className="capitalize">{type}</span>
                </span>
                <span className="text-sm text-gray-600">
                    {available} available / {max} total
                </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div
                    className={`h-2.5 rounded-full ${getColor()}`}
                    style={{ width: `${percentage}%` }}
                ></div>
            </div>
            <p className="text-xs text-gray-500 mt-1">{current} occupied ({percentage}%)</p>
        </div>
    );
}

function CapacitySummaryWidget() {
    const [lot, setLot] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [fetched, setFetched] = useState(false);

    useEffect(() => {
        const loadLot = async () => {
            setLoading(true);
            setError(null);
            try {
                const data = await fetchMyLot();
                setLot(data);
            } catch (err) {
                console.error("Error fetching lot data:", err);
                setError("Failed to load lot capacity data.");
            } finally {
                setLoading(false);
                setFetched(true);
            }
        };
        loadLot();
    }, []);

    if (loading) {
        return (
            <div className="bg-white rounded-lg shadow-md p-6 animate-pulse">
                <div className="h-5 bg-gray-200 rounded w-1/3 mb-4"></div>
                <div className="h-3 bg-gray-200 rounded w-full mb-3"></div>
                <div className="h-3 bg-gray-200 rounded w-full mb-3"></div>
                <div className="h-3 bg-gray-200 rounded w-2/3"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-3">Capacity Summary</h2>
                <div className="flex items-center gap-2 text-red-600">
                    <FaExclamationTriangle className="h-4 w-4" />
                    <p className="text-sm">{error}</p>
                </div>
            </div>
        );
    }

    if (fetched && !lot) {
        return (
            <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-3">Capacity Summary</h2>
                <p className="text-gray-500 text-sm">You are not assigned to a parking lot</p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-1">Capacity Summary</h2>
            <p className="text-sm text-gray-500 mb-4">{lot.lot_name}</p>
            <CapacityBar
                current={lot.current_car}
                max={lot.car_capacity}
                type="car"
                icon={<FaCar className="h-3.5 w-3.5 text-blue-500" />}
            />
            <CapacityBar
                current={lot.current_bike}
                max={lot.bike_capacity}
                type="bike"
                icon={<FaMotorcycle className="h-3.5 w-3.5 text-green-500" />}
            />
        </div>
    );
}

function RecentAlertsWidget() {
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchNotifications = async () => {
            setLoading(true);
            setError(null);
            try {
                const response = await api.get("/employee/notifications");
                const data = response.data.data || [];
                setNotifications(data.slice(0, 5));
            } catch (err) {
                console.error("Error fetching notifications:", err);
                setError("Failed to load recent alerts.");
            } finally {
                setLoading(false);
            }
        };
        fetchNotifications();
    }, []);

    if (loading) {
        return (
            <div className="bg-white rounded-lg shadow-md p-6 animate-pulse">
                <div className="h-5 bg-gray-200 rounded w-1/3 mb-4"></div>
                <div className="space-y-3">
                    <div className="h-3 bg-gray-200 rounded w-full"></div>
                    <div className="h-3 bg-gray-200 rounded w-full"></div>
                    <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-3">Recent Alerts</h2>
                <div className="flex items-center gap-2 text-red-600">
                    <FaExclamationTriangle className="h-4 w-4" />
                    <p className="text-sm">{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-3">Recent Alerts</h2>
            {notifications.length === 0 ? (
                <p className="text-gray-500 text-sm">No recent alerts.</p>
            ) : (
                <ul className="space-y-3">
                    {notifications.map((notification) => {
                        const isUnread = notification.read_at === null;
                        return (
                            <li
                                key={notification.noti_id}
                                className="flex items-start gap-2"
                            >
                                {isUnread && (
                                    <span className="mt-1.5 h-2 w-2 rounded-full bg-blue-500 shrink-0" />
                                )}
                                <div className={`flex-1 ${!isUnread ? "ml-4" : ""}`}>
                                    <p className="text-sm font-medium text-gray-800">{notification.title}</p>
                                    <p className="text-xs text-gray-400">
                                        {new Date(notification.created_at).toLocaleDateString(undefined, {
                                            year: "numeric",
                                            month: "short",
                                            day: "numeric",
                                            hour: "2-digit",
                                            minute: "2-digit",
                                        })}
                                    </p>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}

export default function EmployeePage() {
    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <CapacitySummaryWidget />
                <RecentAlertsWidget />
            </div>
        </div>
    );
}
