"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
    HiHome,
    HiOfficeBuilding,
    HiCog,
    HiMenu,
    HiX,
    HiIdentification,
    HiQuestionMarkCircle,
    HiOutlineCash,
    HiSpeakerphone,
} from "react-icons/hi";
import { HiCheckBadge, HiDocumentCurrencyDollar, HiPresentationChartLine, HiSpeakerXMark } from "react-icons/hi2";

import { logout } from "../../api/auth.client";
import { useUser } from "../providers/UserProvider";

const Sidebar = () => {
    const pathname = usePathname();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const { user } = useUser();

    // Only render on admin pages
    if (!pathname?.startsWith("/admin")) {
        return null;
    }

    // Close sidebar when navigating between pages
    useEffect(() => {
        setSidebarOpen(false);
    }, [pathname]);

    // Function to check if a link is active
    const isActive = (path) => pathname === path;

    // Navigation items
    const navItems = [
        {
            name: "Home",
            href: "/admin/",
            icon: <HiHome className="mr-3 h-6 w-6" />,
        },
        {
            name: "Parking Lots",
            href: "/admin/parking-lots",
            icon: <HiOfficeBuilding className="mr-3 h-6 w-6" />,
        },
        {
            name: "Users",
            href: "/admin/users",
            icon: <HiIdentification className="mr-3 h-6 w-6" />,
        },
        {
            name: "Monthly subs",
            href: "/admin/monthly-subs",
            icon: <HiCheckBadge className="mr-3 h-6 w-6" />,
        },
        {
            name: "Payments",
            href: "/admin/payments",
            icon: <HiDocumentCurrencyDollar className="mr-3 h-6 w-6" />,
        },
        {
            name: "Lost tickets",
            href: "/admin/lost-tickets",
            icon: <HiQuestionMarkCircle className="mr-3 h-6 w-6" />,
        },
        {
            name: "Insight",
            href: "/admin/insight",
            icon: <HiPresentationChartLine className="mr-3 h-6 w-6" />,
        },
        {
            name: "Configurations",
            href: "/admin/config",
            icon: <HiCog className="mr-3 h-6 w-6" />,
        },

        {
            name: "Notifications",
            href: "/admin/notifications",
            icon: <HiSpeakerphone className="mr-3 h-6 w-6" />,
        },
    ];

    // Render navigation links
    const renderNavigation = () => {
        return navItems.map((item) => {
            const active = isActive(item.href);
            return (
                <Link
                    key={item.name}
                    href={item.href}
                    className={`group flex items-center px-2 py-2 text-base font-medium rounded-md ${
                        active ? "bg-indigo-100 text-indigo-700" : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                    }`}
                >
                    {item.icon}
                    {item.name}
                </Link>
            );
        });
    };

    const handleLogout = async () => {
        try {
            await logout();
        } catch (error) {
            console.error("Error during logout:", error);
        }
    };

    return (
        <>
            {/* Mobile menu button */}
            <div className="sticky top-0 z-10 md:hidden pl-1 pt-1 sm:pl-3 sm:pt-3 bg-gray-100">
                <button
                    type="button"
                    className="-ml-0.5 -mt-0.5 h-12 w-12 inline-flex items-center justify-center rounded-md text-gray-500 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500"
                    onClick={() => setSidebarOpen(true)}
                >
                    <span className="sr-only">Open sidebar</span>
                    <HiMenu className="h-6 w-6" />
                </button>
            </div>

            {/* Mobile sidebar */}
            <div
                className="fixed inset-0 z-40 flex md:hidden"
                role="dialog"
                aria-modal="true"
                style={{ display: sidebarOpen ? "flex" : "none" }}
            >
                <div
                    className="fixed inset-0 bg-gray-600 bg-opacity-75"
                    aria-hidden="true"
                    onClick={() => setSidebarOpen(false)}
                ></div>

                <div className="relative flex-1 flex flex-col max-w-xs w-full bg-white shadow-xl">
                    <div className="absolute top-0 right-0 -mr-12 pt-2">
                        <button
                            className="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
                            onClick={() => setSidebarOpen(false)}
                        >
                            <span className="sr-only">Close sidebar</span>
                            <HiX className="h-6 w-6 text-white" />
                        </button>
                    </div>

                    <div className="flex-1 h-0 pt-5 pb-4 overflow-y-auto">
                        <div className="flex-shrink-0 flex items-center px-4">
                            <span className="text-indigo-600 font-bold text-xl">Parking System</span>
                        </div>
                        <nav className="mt-5 px-2 space-y-1">{renderNavigation()}</nav>
                    </div>
                    <div className="flex-shrink-0 flex border-t border-gray-200 p-4">
                        <div className="flex items-center">
                            <div className="ml-3"></div>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="ml-auto bg-gray-200 hover:bg-gray-300 rounded-md px-3 py-1 text-sm font-medium text-gray-700"
                        >
                            Logout
                        </button>
                    </div>
                </div>
            </div>

            {/* Static sidebar for desktop */}
            <div className="hidden md:block md:w-64 md:flex-none">
                <div
                    className="flex flex-col border-r border-gray-200 bg-white fixed top-0 bottom-0"
                    style={{ width: "16rem" }}
                >
                    <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
                        <div className="flex items-center flex-shrink-0 px-4">
                            <span className="text-indigo-600 font-bold text-xl">Parking System</span>
                        </div>
                        <nav className="mt-5 flex-1 px-2 space-y-1">{renderNavigation()}</nav>
                    </div>
                    <div className="flex-shrink-0 flex border-t border-gray-200 p-4">
                        <div className="flex items-center">
                            <div className="ml-3">
                                <p className="text-base font-medium text-gray-700">{user?.full_name}</p>
                                <p className="text-sm font-medium text-gray-500">{user?.username}</p>
                            </div>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="ml-auto bg-gray-200 hover:bg-gray-300 rounded-md px-3 py-1 text-sm font-medium text-gray-700"
                        >
                            Logout
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};

export default Sidebar;
