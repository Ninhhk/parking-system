"use client";

//import Sidebar from "../components/admin/Sidebar";
import { useRouter } from "next/navigation";
import api from "../api/client.config";
import { useEffect, useState } from "react";
import { useUser } from "../components/providers/UserProvider";

export default function EmployeePage() {
    const { user } = useUser();
    const [notifications, setNotifications] = useState([]);
    const router = useRouter();

    useEffect(() => {
        const fetchNotifications = async () => {
            try {
                const response = await api.get("/employee/notifications");
                setNotifications(response.data.data.slice(0, 3)); // Display the latest 3 notifications
            } catch (error) {
                console.error("Error fetching notifications:", error);
            }
        };

        fetchNotifications();
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
                <div className="bg-white shadow-md rounded-lg p-6">
                    <h1 className="text-3xl font-bold text-gray-800 mb-4">Welcome, {user?.full_name}</h1>
                    <blockquote className="italic text-gray-500 border-l-4 border-gray-300 pl-4 mb-6">
                        "The only way to do great work is to love what you do." – Steve Jobs
                    </blockquote>
                    <div className="grid grid-cols-2 gap-6">
                        <div
                            className="bg-blue-100 text-blue-800 p-4 rounded-lg shadow-md hover:bg-blue-200 transition cursor-pointer"
                            onClick={() => handleNavigation("/employee/monitor")}
                        >
                            <h2 className="text-xl font-semibold">Monitor Parking Lot</h2>
                            <p className="text-sm">View your parking lot's status.</p>
                        </div>
                        <div
                            className="bg-green-100 text-green-800 p-4 rounded-lg shadow-md hover:bg-green-200 transition cursor-pointer"
                            onClick={() => handleNavigation("/employee/checkin")}
                        >
                            <h2 className="text-xl font-semibold">Process Check-in</h2>
                            <p className="text-sm">Approve vehicle into parking lot.</p>
                        </div>
                        <div
                            className="bg-yellow-100 text-yellow-800 p-4 rounded-lg shadow-md hover:bg-yellow-200 transition cursor-pointer"
                            onClick={() => handleNavigation("/employee/lost-tickets")}
                        >
                            <h2 className="text-xl font-semibold">Lost tickets</h2>
                            <p className="text-sm">Make reports for lost tickets.</p>
                        </div>
                        <div
                            className="bg-red-100 text-red-800 p-4 rounded-lg shadow-md hover:bg-red-200 transition cursor-pointer"
                            onClick={() => handleNavigation("/employee/checkout")}
                        >
                            <h2 className="text-xl font-semibold">Process Check-out</h2>
                            <p className="text-sm">Approve vehicle out of parking lot and charge.</p>
                        </div>
                        <div
                            className="bg-indigo-100 text-indigo-800 p-4 rounded-lg shadow-md hover:bg-indigo-200 transition cursor-pointer"
                            onClick={() => handleNavigation("/employee/profile")}
                        >
                            <h2 className="text-xl font-semibold">Profile</h2>
                            <p className="text-sm">View and change your informations.</p>
                        </div>
                        <div
                            className="bg-gray-100 text-gray-800 p-4 rounded-lg shadow-md hover:bg-gray-200 transition cursor-pointer"
                            onClick={() => handleNavigation("/employee/notifications")}
                        >
                            <h2 className="text-xl font-semibold">Notifications</h2>
                            <p className="text-sm">Keep track with the lastest news.</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white shadow-md rounded-lg p-6 mt-6">
                    <h2 className="text-2xl font-bold text-gray-800 mb-4">Recent Notifications</h2>
                    {notifications.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {notifications.map((notification, index) => (
                                <div
                                    key={index}
                                    className="bg-gray-100 p-4 rounded-lg shadow-md hover:bg-gray-200 transition cursor-pointer"
                                    onClick={() => router.push(`/employee/notifications/${notification.noti_id}`)}
                                >
                                    <h3 className="text-lg font-semibold text-gray-800 mb-2">{notification.title}</h3>
                                    <p className="text-sm text-gray-600 mb-2">
                                        {notification.message.length > 30
                                            ? `${notification.message.slice(0, 30)}...`
                                            : notification.message}
                                    </p>
                                    <p className="text-xs text-gray-400">
                                        {new Date(notification.created_at).toLocaleDateString()} by{" "}
                                        {notification.username}
                                    </p>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-gray-600">No recent notifications available.</p>
                    )}
                </div>
            </main>
        </div>
    );
}
