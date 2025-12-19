"use client";

import { useState, useEffect } from "react";
import { fetchMyProfile, updateMyProfile } from "../../api/employee.client";
import PageHeader from "../../components/common/PageHeader";
import Modal from "../../components/common/Modal";
import { useUser } from "../../components/providers/UserProvider";
import { FaUser, FaIdCard, FaUserTag, FaEnvelope, FaLock } from "react-icons/fa";

export default function ProfilePage() {
    const { user } = useUser();
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
    
    // Form states for password change
    const [formData, setFormData] = useState({
        current_password: "",
        new_password: "",
        confirm_password: ""
    });
    
    const [passwordError, setPasswordError] = useState(null);
    const [passwordLoading, setPasswordLoading] = useState(false);
    const [successMessage, setSuccessMessage] = useState(null);

    useEffect(() => {
        async function loadProfile() {
            try {
                setLoading(true);
                const profileData = await fetchMyProfile();
                setProfile(profileData);
                setError(null);
            } catch (err) {
                console.error("Failed to load profile:", err);
                setError("Failed to load profile information. Please try again later.");
            } finally {
                setLoading(false);
            }
        }

        loadProfile();
    }, []);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData({
            ...formData,
            [name]: value,
        });
        
        // Clear messages when typing
        setPasswordError(null);
        setSuccessMessage(null);
    };

    const handleUpdatePassword = async (e) => {
        e.preventDefault();
        
        // Form validation
        if (!formData.current_password || !formData.new_password || !formData.confirm_password) {
            setPasswordError("All fields are required");
            return;
        }

        if (formData.new_password !== formData.confirm_password) {
            setPasswordError("New password and confirmation do not match");
            return;
        }

        try {
            setPasswordLoading(true);
            await updateMyProfile({
                current_password: formData.current_password,
                new_password: formData.new_password,
            });
            
            setSuccessMessage("Password updated successfully");
            setFormData({
                current_password: "",
                new_password: "",
                confirm_password: ""
            });
            
            // Close the modal after a short delay to show success message
            setTimeout(() => {
                setIsPasswordModalOpen(false);
                setSuccessMessage(null);
            }, 1500);
        } catch (err) {
            console.error("Failed to update password:", err);
            setPasswordError(err.response?.data?.message || "Failed to update password");
        } finally {
            setPasswordLoading(false);
        }
    };
    
    const handleCloseModal = () => {
        setIsPasswordModalOpen(false);
        setPasswordError(null);
        setSuccessMessage(null);
        setFormData({
            current_password: "",
            new_password: "",
            confirm_password: ""
        });
    };

    if (loading) return (
        <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            <span className="ml-3 text-lg text-gray-700">Loading profile information...</span>
        </div>
    );
    
    if (error) return (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded shadow-md">
            <p className="font-medium">Error</p>
            <p>{error}</p>
        </div>
    );

    return (
        <div>
            <PageHeader title="My Profile" />

            {profile && (
                <div className="bg-gradient-to-br from-white to-blue-50 rounded-lg shadow-lg overflow-hidden border border-gray-200">
                    <div className="relative p-8">
                        {/* Profile Header with Avatar */}
                        <div className="flex flex-col sm:flex-row items-center sm:items-start mb-8 pb-6 border-b border-gray-200">
                            <div className="bg-blue-500 text-white rounded-full h-24 w-24 flex items-center justify-center text-4xl shadow-md">
                                {profile.full_name ? profile.full_name.charAt(0).toUpperCase() : "U"}
                            </div>
                            <div className="mt-4 sm:mt-0 sm:ml-6 text-center sm:text-left">
                                <h1 className="text-2xl font-bold text-gray-800">{profile.full_name || profile.username}</h1>
                                <div className="mt-1 flex items-center justify-center sm:justify-start">
                                    <span className="bg-blue-100 text-blue-800 text-sm font-medium px-3 py-1 rounded-full capitalize flex items-center">
                                        <FaUserTag className="mr-1" /> {profile.role}
                                    </span>
                                    <span className="ml-2 text-sm text-gray-500">ID: {profile.user_id}</span>
                                </div>
                            </div>
                        </div>
                        
                        {/* User Information */}
                        <div className="mb-8">
                            <h2 className="text-xl font-semibold mb-4 flex items-center text-gray-800">
                                <FaUser className="mr-2 text-blue-500" />
                                User Information
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 transition-all hover:shadow-md">
                                    <label className="block text-sm font-medium text-gray-500 mb-1">Username</label>
                                    <div className="flex items-center">
                                        <FaIdCard className="text-blue-500 mr-2" />
                                        <p className="font-semibold text-gray-800">{profile.username}</p>
                                    </div>
                                </div>
                                <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 transition-all hover:shadow-md">
                                    <label className="block text-sm font-medium text-gray-500 mb-1">Full Name</label>
                                    <div className="flex items-center">
                                        <FaUser className="text-blue-500 mr-2" />
                                        <p className="font-semibold text-gray-800">{profile.full_name || "Not set"}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Security Section */}
                        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
                            <h3 className="text-lg font-semibold mb-4 flex items-center text-gray-800">
                                <FaLock className="mr-2 text-blue-500" />
                                Security
                            </h3>
                            <p className="text-gray-600 mb-4">
                                Protect your account by changing your password regularly. We recommend using a strong password that you don't use elsewhere.
                            </p>
                            <button 
                                type="button"
                                onClick={() => setIsPasswordModalOpen(true)}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-md shadow-sm transition-all hover:shadow flex items-center"
                            >
                                <FaLock className="mr-2" /> Change Password
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Password Change Modal */}
            <Modal
                isOpen={isPasswordModalOpen}
                onClose={handleCloseModal}
                title="Change Password"
                mode="update"
                onSubmit={handleUpdatePassword}
                error={passwordError}
                loading={passwordLoading}
                submitText="Update Password"
            >
                {successMessage && (
                    <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-md mb-4 flex items-center">
                        <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path>
                        </svg>
                        {successMessage}
                    </div>
                )}
                
                <div className="space-y-5">
                    <div className="relative">
                        <label htmlFor="current_password" className="block text-sm font-medium text-gray-700 mb-1">
                            Current Password
                        </label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <FaLock className="h-5 w-5 text-gray-400" />
                            </div>
                            <input 
                                type="password"
                                id="current_password"
                                name="current_password"
                                value={formData.current_password}
                                onChange={handleInputChange}
                                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                                placeholder="Enter your current password"
                            />
                        </div>
                    </div>
                    
                    <div className="relative">
                        <label htmlFor="new_password" className="block text-sm font-medium text-gray-700 mb-1">
                            New Password
                        </label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <FaLock className="h-5 w-5 text-gray-400" />
                            </div>
                            <input 
                                type="password"
                                id="new_password"
                                name="new_password"
                                value={formData.new_password}
                                onChange={handleInputChange}
                                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                                placeholder="Enter your new password"
                            />
                        </div>
                        <p className="mt-1 text-xs text-gray-500">
                            Password should be at least 8 characters long
                        </p>
                    </div>
                    
                    <div className="relative">
                        <label htmlFor="confirm_password" className="block text-sm font-medium text-gray-700 mb-1">
                            Confirm New Password
                        </label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <FaLock className="h-5 w-5 text-gray-400" />
                            </div>
                            <input 
                                type="password"
                                id="confirm_password"
                                name="confirm_password"
                                value={formData.confirm_password}
                                onChange={handleInputChange}
                                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                                placeholder="Confirm your new password"
                            />
                        </div>
                    </div>
                </div>
            </Modal>
        </div>
    );
}