"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
    HiHome,
    HiMenu,
    HiX,
    HiIdentification,
    HiSpeakerphone,
    HiBell,
} from "react-icons/hi";
import {
    HiOutlineArrowLeftEndOnRectangle,
    HiOutlineArrowRightEndOnRectangle,
} from "react-icons/hi2";

import { logout } from "../../api/auth.client";
import { useUser } from "../providers/UserProvider";
import api from "../../api/client.config";
import BellPreview from "./BellPreview";

const Navbar = () => {
    const pathname = usePathname();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [notifications, setNotifications] = useState(null);
    const [previewOpen, setPreviewOpen] = useState(false);
    const { user } = useUser();

    // Close mobile menu when navigating
    useEffect(() => {
        setMobileMenuOpen(false);
    }, [pathname]);

    // Fetch notifications on mount
    useEffect(() => {
        const fetchNotifications = async () => {
            try {
                const response = await api.get("/employee/notifications");
                setNotifications(response.data.data);
            } catch {
                setNotifications(null);
            }
        };
        fetchNotifications();
    }, []);

    // Only render on employee pages (after hooks, to respect Rules of Hooks)
    if (!pathname?.startsWith("/employee")) {
        return null;
    }

    const hasUnread = Array.isArray(notifications) && notifications.some(n => n.read_at === null);

    const isActive = (path) => pathname === path;

    const navItems = [
        { name: "Home", href: "/employee/", icon: <HiHome className="mr-1.5 h-4 w-4" /> },
        { name: "Check-in", href: "/employee/checkin", icon: <HiOutlineArrowRightEndOnRectangle className="mr-1.5 h-4 w-4" /> },
        { name: "Check-out", href: "/employee/checkout", icon: <HiOutlineArrowLeftEndOnRectangle className="mr-1.5 h-4 w-4" /> },
        { name: "Alerts", href: "/employee/notifications", icon: <HiSpeakerphone className="mr-1.5 h-4 w-4" /> },
        { name: "Profile", href: "/employee/profile", icon: <HiIdentification className="mr-1.5 h-4 w-4" /> },
    ];

    const handleLogout = async () => {
        try {
            await logout();
        } catch (error) {
            console.error("Error during logout:", error);
        }
    };

    return (
        <nav className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-xs">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-16">
                    {/* Left: Brand & Lane Info */}
                    <div className="flex items-center">
                        <Link href="/employee/" className="flex items-center gap-2 shrink-0 group">
                            <div className="w-8 h-8 rounded-lg bg-indigo-650 text-white flex items-center justify-center font-bold text-lg shadow-xs transition-transform duration-200 group-hover:scale-105">
                                P
                            </div>
                            <span className="font-mono font-bold tracking-wider text-slate-800 text-base">
                                ParkControl
                            </span>
                        </Link>
                        
                        <div className="hidden sm:flex items-center pl-4 ml-4 border-l border-gray-200">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium font-mono bg-emerald-50 text-emerald-700 border border-emerald-150">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                LANE_01: ONLINE
                            </span>
                        </div>
                    </div>

                    {/* Middle: Desktop Nav Links */}
                    <div className="hidden lg:flex items-center space-x-1 overflow-hidden">
                        {navItems.map((item) => {
                            const active = isActive(item.href);
                            return (
                                <Link
                                    key={item.name}
                                    href={item.href}
                                    className={`inline-flex items-center px-3 py-2 text-xs font-medium rounded-lg transition-all duration-150 ${
                                        active
                                            ? "bg-indigo-50 text-indigo-755 font-semibold"
                                            : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                                    }`}
                                >
                                    {item.icon}
                                    {item.name}
                                </Link>
                            );
                        })}
                    </div>

                    {/* Right: Notification & User Panel */}
                    <div className="hidden sm:flex items-center gap-4">
                        <div className="relative">
                            <button
                                type="button"
                                onClick={() => setPreviewOpen(!previewOpen)}
                                className="p-1.5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-50 relative cursor-pointer"
                                aria-label="Notifications"
                            >
                                <HiBell className="h-5 w-5" />
                                {hasUnread && (
                                    <span className="absolute top-1 right-1 block h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white" />
                                )}
                            </button>
                            <BellPreview open={previewOpen} notifications={notifications} onClose={() => setPreviewOpen(false)} />
                        </div>

                        <div className="flex items-center gap-3 pl-2 border-l border-gray-200">
                            {/* User Avatar Circle */}
                            <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-sm shadow-xs border border-indigo-150 select-none">
                                {user?.full_name?.charAt(0) || "U"}
                            </div>
                            <div className="text-left shrink-0">
                                <p className="text-xs font-semibold text-slate-700 leading-tight">{user?.full_name}</p>
                                <p className="text-[10px] text-slate-400 leading-none mt-0.5">@{user?.username}</p>
                            </div>
                            
                            <button
                                onClick={handleLogout}
                                className="cursor-pointer bg-gray-50 hover:bg-rose-50 hover:text-rose-600 border border-gray-200 hover:border-rose-200 text-gray-600 rounded-lg px-2.5 py-1 text-xs font-semibold tracking-wide transition-all"
                            >
                                Logout
                            </button>
                        </div>
                    </div>

                    {/* Mobile hamburger controls */}
                    <div className="flex items-center lg:hidden">
                        <button
                            type="button"
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                            className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 focus:outline-none"
                        >
                            <span className="sr-only">Toggle navigation</span>
                            {mobileMenuOpen ? <HiX className="h-6 w-6" /> : <HiMenu className="h-6 w-6" />}
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile Dropdown Drawer */}
            {mobileMenuOpen && (
                <div className="lg:hidden border-t border-gray-200 bg-white">
                    <div className="px-2 pt-2 pb-3 space-y-1">
                        {navItems.map((item) => {
                            const active = isActive(item.href);
                            return (
                                <Link
                                    key={item.name}
                                    href={item.href}
                                    className={`flex items-center px-3 py-2.5 rounded-lg text-sm font-medium ${
                                        active
                                            ? "bg-indigo-50 text-indigo-700"
                                            : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                                    }`}
                                >
                                    <div className="mr-3 text-lg">{item.icon}</div>
                                    {item.name}
                                </Link>
                            );
                        })}
                    </div>
                    
                    <div className="pt-4 pb-3 border-t border-gray-200 px-4 bg-gray-50/50">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-9 h-9 rounded-full bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-sm border border-indigo-150">
                                {user?.full_name?.charAt(0) || "U"}
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-slate-800">{user?.full_name}</p>
                                <p className="text-xs text-slate-400">@{user?.username}</p>
                            </div>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="w-full text-center bg-white hover:bg-rose-50 border border-gray-200 hover:border-rose-200 text-gray-700 hover:text-rose-600 font-semibold rounded-lg py-2 text-xs transition-colors"
                        >
                            Logout
                        </button>
                    </div>
                </div>
            )}
        </nav>
    );
};

export default Navbar;
