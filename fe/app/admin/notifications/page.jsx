"use client";

import { useEffect, useState } from "react";
import api from "../../api/client.config";
import { addNotification } from "../../api/admin.client";

function CustomModal({ isOpen, onClose, children }) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 backdrop-blur-sm">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4 relative animate-fadeIn">
                <button
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
                    onClick={onClose}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
                {children}
            </div>
        </div>
    );
}

export default function NotificationsPage() {
    const [notifications, setNotifications] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newNotification, setNewNotification] = useState({ title: "", message: "" });
    const [userId, setUserId] = useState(null);
    const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
    const [currentNotification, setCurrentNotification] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchUser = async () => {
            try {
                const response = await api.get("/auth/me");
                setUserId(response.data.data.user.user_id);
            } catch (error) {
                console.error("Error fetching user data:", error);
            }
        };

        fetchUser();
    }, []);

    useEffect(() => {
        const fetchNotifications = async () => {
            try {
                setLoading(true);
                const response = await api.get("/admin/notifications");
                setNotifications(response.data.data);
            } catch (error) {
                console.error("Error fetching notifications:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchNotifications();
    }, []);

    const handleAddNotification = async () => {
        try {
            if (!userId) {
                console.error("User ID is not available");
                return;
            }

            const response = await addNotification({ ...newNotification, user_id: userId });
            setNotifications([...notifications, response]);
            setIsModalOpen(false);
            setNewNotification({ title: "", message: "" });
        } catch (error) {
            console.error("Error adding notification:", error);
        }
    };

    const handleUpdateClick = (notification) => {
        setCurrentNotification(notification);
        setIsUpdateModalOpen(true);
    };

    const handleUpdateSubmit = (updatedTitle, updatedMessage) => {
        api.put(`/admin/notifications/${currentNotification.noti_id}`, {
            title: updatedTitle,
            message: updatedMessage,
        })
            .then(() => {
                setNotifications(
                    notifications.map((noti) =>
                        noti.noti_id === currentNotification.noti_id
                            ? { ...noti, title: updatedTitle, message: updatedMessage }
                            : noti
                    )
                );
                setIsUpdateModalOpen(false);
            })
            .catch((error) => {
                console.error("Error updating notification:", error);
            });
    };

    const handleDeleteNotification = async (notificationId, index) => {
        try {
            await api.delete(`/admin/notifications/${notificationId}`);
            setNotifications(notifications.filter((_, i) => i !== index));
        } catch (error) {
            console.error("Error deleting notification:", error);
        }
    };

    return (
        <div className="flex min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
            <main className="flex-1 p-6 max-w-7xl mx-auto">
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
                        <button
                            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow-md transition-all duration-200 transform hover:scale-105"
                            onClick={() => setIsModalOpen(true)}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Add New Notification
                        </button>
                    </div>
                    
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-12">
                            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
                            <p className="text-gray-500">Loading notifications...</p>
                        </div>
                    ) : notifications.length > 0 ? (
                        <div className="grid gap-4 md:grid-cols-2">
                            {notifications.map((notification, index) => (
                                <div 
                                    key={index}
                                    className="bg-white border border-gray-200 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300 overflow-hidden"
                                >
                                    <div className="border-b border-gray-100 bg-gradient-to-r from-blue-50 to-white px-5 py-4">
                                        <h2 
                                            className="text-lg font-bold text-gray-800 cursor-pointer hover:text-blue-600 transition-colors"
                                            onClick={() => {
                                                window.location.href = `/admin/notifications/${notification.noti_id}`;
                                            }}
                                        >
                                            {notification.title}
                                        </h2>
                                        <p className="text-xs text-gray-500 mt-1 flex items-center">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                            </svg>
                                            {new Date(notification.created_at).toLocaleDateString(undefined, {
                                                year: 'numeric',
                                                month: 'short',
                                                day: 'numeric'
                                            })}
                                        </p>
                                    </div>
                                    
                                    <div className="px-5 py-4">
                                        <p className="text-sm text-gray-600 line-clamp-2 mb-4">
                                            {notification.message}
                                        </p>
                                        
                                        <div className="flex justify-end space-x-2">
                                            <button
                                                className="flex items-center gap-1 px-3 py-1.5 bg-yellow-100 text-yellow-700 rounded-md hover:bg-yellow-200 transition-colors"
                                                onClick={() => handleUpdateClick(notification)}
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                </svg>
                                                <span className="text-sm font-medium">Edit</span>
                                            </button>
                                            <button
                                                className="flex items-center gap-1 px-3 py-1.5 bg-red-100 text-red-700 rounded-md hover:bg-red-200 transition-colors"
                                                onClick={() => handleDeleteNotification(notification.noti_id, index)}
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                                <span className="text-sm font-medium">Delete</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <div className="bg-gray-100 p-6 rounded-full mb-4">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-bold text-gray-700 mb-2">No notifications yet</h3>
                            <p className="text-gray-500 max-w-sm mb-6">Start by adding your first notification to keep employees informed.</p>
                            <button 
                                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow-md transition-all"
                                onClick={() => setIsModalOpen(true)}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                Create First Notification
                            </button>
                        </div>
                    )}
                </div>

                {/* Add Notification Modal */}
                <CustomModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
                    <div className="pt-4">
                        <h2 className="text-2xl font-bold text-gray-800 mb-6">Add New Notification</h2>
                        <div className="space-y-4">
                            <div>
                                <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                                <input
                                    id="title"
                                    type="text"
                                    placeholder="Notification title"
                                    value={newNotification.title}
                                    onChange={(e) => setNewNotification({ ...newNotification, title: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                            <div>
                                <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                                <textarea
                                    id="message"
                                    placeholder="Enter notification message"
                                    value={newNotification.message}
                                    onChange={(e) => setNewNotification({ ...newNotification, message: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[120px]"
                                />
                            </div>
                        </div>
                        <div className="mt-6 flex justify-end gap-3">
                            <button
                                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
                                onClick={() => setIsModalOpen(false)}
                            >
                                Cancel
                            </button>
                            <button
                                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2"
                                onClick={handleAddNotification}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                </svg>
                                Post Notification
                            </button>
                        </div>
                    </div>
                </CustomModal>

                {/* Update Notification Modal */}
                <CustomModal isOpen={isUpdateModalOpen} onClose={() => setIsUpdateModalOpen(false)}>
                    <div className="pt-4">
                        <h2 className="text-2xl font-bold text-gray-800 mb-6">Update Notification</h2>
                        <div className="space-y-4">
                            <div>
                                <label htmlFor="updateTitle" className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                                <input
                                    id="updateTitle"
                                    type="text"
                                    placeholder="Notification title"
                                    defaultValue={currentNotification?.title}
                                    onChange={(e) => setCurrentNotification({ ...currentNotification, title: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                            <div>
                                <label htmlFor="updateMessage" className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                                <textarea
                                    id="updateMessage"
                                    placeholder="Enter notification message"
                                    defaultValue={currentNotification?.message}
                                    onChange={(e) => setCurrentNotification({ ...currentNotification, message: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[120px]"
                                />
                            </div>
                        </div>
                        <div className="mt-6 flex justify-end gap-3">
                            <button
                                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
                                onClick={() => setIsUpdateModalOpen(false)}
                            >
                                Cancel
                            </button>
                            <button
                                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2"
                                onClick={() => handleUpdateSubmit(currentNotification.title, currentNotification.message)}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                Save Changes
                            </button>
                        </div>
                    </div>
                </CustomModal>
            </main>
        </div>
    );
}