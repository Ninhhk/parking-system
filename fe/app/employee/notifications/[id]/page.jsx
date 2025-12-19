"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import api from "../../../api/client.config";

export default function SingleNotificationPage() {
    const [notification, setNotification] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const { id: notificationId } = useParams();
    const router = useRouter();

    useEffect(() => {
        const fetchNotification = async () => {
            try {
                const response = await api.get(`/employee/notifications/${notificationId}`);
                setNotification(response.data.data);
            } catch (err) {
                setError("Failed to load notification.");
            } finally {
                setLoading(false);
            }
        };

        if (notificationId) {
            fetchNotification();
        } else {
            setError("Notification ID is missing.");
            setLoading(false);
        }
    }, [notificationId]);

    const handleGoBack = () => {
        router.back();
    };

    if (loading) {
        return (
            <div className="flex min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 items-center justify-center">
                <div className="flex flex-col items-center p-8">
                    <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500 mb-4"></div>
                    <p className="text-lg text-gray-600">Loading notification...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 items-center justify-center">
                <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full">
                    <div className="flex items-center justify-center mb-4">
                        <div className="bg-red-100 p-3 rounded-full">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                    </div>
                    <h1 className="text-2xl font-bold text-gray-800 mb-4 text-center">Error</h1>
                    <p className="text-red-600 text-center mb-6">{error}</p>
                    <button
                        onClick={handleGoBack}
                        className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-300 flex items-center justify-center"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        Go Back
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
            <main className="flex-1 p-6 max-w-4xl mx-auto">
                <div className="bg-white shadow-lg rounded-xl p-8 border border-gray-100 relative">
                    <button
                        onClick={handleGoBack}
                        className="absolute top-6 left-6 flex items-center text-blue-600 hover:text-blue-800 transition-colors duration-300 group"
                    >
                        <div className="bg-blue-50 p-2 rounded-full group-hover:bg-blue-100 transition-colors duration-300">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                        </div>
                        <span className="ml-2 font-medium">Back</span>
                    </button>
                    
                    <div className="mt-8 mb-10">
                        <div className="flex justify-center mb-6">
                            <div className="bg-blue-100 p-4 rounded-full">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                </svg>
                            </div>
                        </div>
                        
                        <h1 className="text-3xl font-bold text-gray-800 mb-4 text-center">{notification.title}</h1>
                        
                        <div className="flex items-center justify-center gap-2 mb-8">
                            <div className="h-8 w-8 bg-gray-200 rounded-full flex items-center justify-center text-gray-600 font-semibold">
                                {notification.username ? notification.username.charAt(0).toUpperCase() : "U"}
                            </div>
                            <div>
                                <p className="text-sm text-gray-600">{notification.username}</p>
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
                        </div>
                        
                        <div className="bg-gray-50 rounded-xl p-6 border border-gray-100">
                            <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{notification.message}</p>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}