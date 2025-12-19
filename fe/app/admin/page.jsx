"use client";

//import Sidebar from "../components/admin/Sidebar";
import { useRouter } from "next/navigation";
import api from "../api/client.config";
import { useEffect, useState } from "react";
import { useUser } from "../components/providers/UserProvider";
import {
    HiUserGroup,
    HiOfficeBuilding,
    HiCash,
    HiCreditCard,
    HiDocumentText,
    HiExclamation,
    HiChartBar,
    HiBell,
} from "react-icons/hi";

export default function AdminPage() {
    const { user } = useUser();
    const [notifications, setNotifications] = useState([]);
    const [stats, setStats] = useState({
        totalUsers: 0,
        totalLots: 0,
        monthlyRevenue: 0,
        activeSubscriptions: 0,
    });
    const router = useRouter();

    useEffect(() => {
        const fetchNotifications = async () => {
            try {
                const response = await api.get("/admin/notifications");
                setNotifications(response.data.data.slice(0, 3)); // Display the latest 3 notifications
            } catch (error) {
                console.error("Error fetching notifications:", error);
            }
        };

        const fetchStats = async () => {
            try {
                const response = await api.get("/admin/analytics/stats");
                if (response.data.success) {
                    const { totalRevenue, totalUsers, totalLots, averageTimeMinutes } = response.data.data;
                    setStats({
                        totalUsers,
                        totalLots,
                        monthlyRevenue: totalRevenue,
                        activeSubscriptions: 87, // Keep this as is - no API endpoint yet
                    });
                }
            } catch (error) {
                console.error("Error fetching stats:", error);
            }
        };

        fetchNotifications();
        fetchStats();
    }, []);

    const handleNavigation = (path) => {
        router.push(path);
    };

    const formatDate = (dateStr) => {
        const date = new Date(dateStr);
        const year = date.getFullYear();
        const day = ("0" + date.getDate()).slice(-2);
        const month = ("0" + (date.getMonth() + 1)).slice(-2);
        return `${year}-${day}-${month}`;
    };

    return (
        <div className="flex min-h-screen bg-gray-50">
            <main className="flex-1 p-6">
                {/* Welcome Banner */}
                <div className="bg-gradient-to-r from-indigo-600 to-blue-500 shadow-lg rounded-lg p-6 mb-6">
                    <h1 className="text-3xl font-bold text-white mb-2">Welcome back, {user?.full_name}</h1>
                    <p className="text-indigo-100">Here's what's happening with your parking system today.</p>
                </div>

                {/* Quick Access Cards */}
                <div className="mb-6">
                    <h2 className="text-xl font-bold text-gray-800 mb-4">Quick Actions</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div
                            className="bg-white p-5 rounded-lg shadow-md hover:shadow-lg transition-all flex flex-col items-center justify-center cursor-pointer"
                            onClick={() => handleNavigation("/admin/users")}
                        >
                            <div className="bg-blue-100 p-3 rounded-full mb-3">
                                <HiUserGroup className="text-blue-500 text-xl" />
                            </div>
                            <h3 className="text-md font-semibold text-center">Manage Users</h3>
                        </div>

                        <div
                            className="bg-white p-5 rounded-lg shadow-md hover:shadow-lg transition-all flex flex-col items-center justify-center cursor-pointer"
                            onClick={() => handleNavigation("/admin/parking-lots")}
                        >
                            <div className="bg-green-100 p-3 rounded-full mb-3">
                                <HiOfficeBuilding className="text-green-500 text-xl" />
                            </div>
                            <h3 className="text-md font-semibold text-center">Parking Lots</h3>
                        </div>

                        <div
                            className="bg-white p-5 rounded-lg shadow-md hover:shadow-lg transition-all flex flex-col items-center justify-center cursor-pointer"
                            onClick={() => handleNavigation("/admin/payments")}
                        >
                            <div className="bg-yellow-100 p-3 rounded-full mb-3">
                                <HiCash className="text-yellow-500 text-xl" />
                            </div>
                            <h3 className="text-md font-semibold text-center">Payments</h3>
                        </div>

                        <div
                            className="bg-white p-5 rounded-lg shadow-md hover:shadow-lg transition-all flex flex-col items-center justify-center cursor-pointer"
                            onClick={() => handleNavigation("/admin/monthly-subs")}
                        >
                            <div className="bg-purple-100 p-3 rounded-full mb-3">
                                <HiCreditCard className="text-purple-500 text-xl" />
                            </div>
                            <h3 className="text-md font-semibold text-center">Subscriptions</h3>
                        </div>
                    </div>
                </div>

                {/* Additional Actions */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                    <div
                        className="bg-white p-6 rounded-lg shadow-md border hover:shadow-lg transition-all cursor-pointer flex items-center"
                        onClick={() => handleNavigation("/admin/insight")}
                    >
                        <div className="bg-indigo-100 p-3 rounded-full mr-4">
                            <HiChartBar className="text-indigo-500 text-xl" />
                        </div>
                        <div>
                            <h3 className="text-md font-semibold">View Insights</h3>
                            <p className="text-sm text-gray-500">Check business analytics and reports</p>
                        </div>
                    </div>

                    <div
                        className="bg-white p-6 rounded-lg shadow-md border hover:shadow-lg transition-all cursor-pointer flex items-center"
                        onClick={() => handleNavigation("/admin/lost-tickets")}
                    >
                        <div className="bg-red-100 p-3 rounded-full mr-4">
                            <HiExclamation className="text-red-500 text-xl" />
                        </div>
                        <div>
                            <h3 className="text-md font-semibold">Lost Tickets</h3>
                            <p className="text-sm text-gray-500">Manage and resolve ticket issues</p>
                        </div>
                    </div>

                    <div
                        className="bg-white p-6 rounded-lg shadow-md border hover:shadow-lg transition-all cursor-pointer flex items-center"
                        onClick={() => handleNavigation("/admin/config")}
                    >
                        <div className="bg-gray-100 p-3 rounded-full mr-4">
                            <HiDocumentText className="text-gray-500 text-xl" />
                        </div>
                        <div>
                            <h3 className="text-md font-semibold">System Config</h3>
                            <p className="text-sm text-gray-500">Adjust fees and settings</p>
                        </div>
                    </div>
                </div>

                {/* Recent Notifications */}
                <div className="bg-white shadow-md rounded-lg p-6">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold text-gray-800">Recent Notifications</h2>
                        <button
                            onClick={() => handleNavigation("/admin/notifications")}
                            className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                        >
                            View All
                        </button>
                    </div>

                    {notifications.length > 0 ? (
                        <div className="space-y-4">
                            {notifications.map((notification, index) => (
                                <div
                                    key={index}
                                    className="bg-gray-50 p-4 rounded-lg hover:bg-gray-100 transition cursor-pointer flex items-start"
                                    onClick={() => router.push(`/admin/notifications/${notification.noti_id}`)}
                                >
                                    <div className="bg-indigo-100 p-2 rounded-full mr-4">
                                        <HiBell className="text-indigo-500 text-lg" />
                                    </div>
                                    <div>
                                        <h3 className="text-md font-semibold text-gray-800">{notification.title}</h3>
                                        <p className="text-sm text-gray-600 mt-1">
                                            {notification.message.length > 60
                                                ? `${notification.message.slice(0, 60)}...`
                                                : notification.message}
                                        </p>
                                        <div className="flex mt-2 text-xs text-gray-400">
                                            <span>{new Date(notification.created_at).toLocaleDateString()}</span>
                                            <span className="mx-2">•</span>
                                            <span>{notification.username}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-6 text-center">
                            <div className="bg-gray-100 p-3 rounded-full mb-3">
                                <HiBell className="text-gray-400 text-xl" />
                            </div>
                            <p className="text-gray-500">No recent notifications available.</p>
                            <button
                                onClick={() => handleNavigation("/admin/notifications")}
                                className="mt-2 text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                            >
                                Create Notification
                            </button>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
