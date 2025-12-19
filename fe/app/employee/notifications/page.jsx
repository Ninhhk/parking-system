"use client";

import { useEffect, useState } from "react";
import api from "../../api/client.config";
import { useRouter } from "next/navigation";

export default function NotificationsPage() {
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        const fetchNotifications = async () => {
            try {
                setLoading(true);
                const response = await api.get("/employee/notifications");
                setNotifications(response.data.data);
            } catch (error) {
                console.error("Error fetching notifications:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchNotifications();
    }, []);

    return (
        <div className="flex min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
            <main className="flex-1 p-6 max-w-5xl mx-auto">
                <div className="bg-white shadow-lg rounded-xl p-8 border border-gray-100">
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-3">
                            <div className="bg-blue-100 p-3 rounded-full">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                </svg>
                            </div>
                            <h1 className="text-3xl font-extrabold text-gray-800">Notifications</h1>
                        </div>
                        {notifications.length > 0 && (
                            <div className="bg-blue-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                                {notifications.length}
                            </div>
                        )}
                    </div>

                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-12">
                            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
                            <p className="text-gray-500">Loading notifications...</p>
                        </div>
                    ) : notifications.length > 0 ? (
                        <ul className="space-y-4">
                            {notifications.map((notification, index) => {
                                const isUnread = !notification.read_at;
                                return (
                                    <li
                                        key={index}
                                        className={`relative border ${isUnread ? 'border-blue-200 bg-blue-50' : 'border-gray-100 bg-white'} p-5 rounded-lg shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer transform hover:-translate-y-1`}
                                        onClick={() => router.push(`/employee/notifications/${notification.noti_id}`)}
                                    >
                                        {isUnread && (
                                            <div className="absolute top-4 right-4">
                                                <div className="h-2 w-2 bg-blue-500 rounded-full"></div>
                                            </div>
                                        )}
                                        <h3 className="text-lg font-bold text-gray-800 mb-2">{notification.title}</h3>
                                        <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                                            {notification.message}
                                        </p>
                                        <div className="flex items-center justify-between mt-2">
                                            <div className="flex items-center gap-2">
                                                <div className="h-8 w-8 bg-gray-200 rounded-full flex items-center justify-center text-gray-600 font-semibold">
                                                    {notification.username ? notification.username.charAt(0).toUpperCase() : "U"}
                                                </div>
                                                <p className="text-xs text-gray-500">{notification.username}</p>
                                            </div>
                                            <p className="text-xs text-gray-400">
                                                {new Date(notification.created_at).toLocaleDateString(undefined, { 
                                                    year: 'numeric', 
                                                    month: 'short', 
                                                    day: 'numeric',
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                })}
                                            </p>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <div className="bg-gray-100 p-6 rounded-full mb-4">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-bold text-gray-700 mb-2">No notifications yet</h3>
                            <p className="text-gray-500 max-w-sm">You don't have any notifications at the moment. Check back later for updates.</p>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}