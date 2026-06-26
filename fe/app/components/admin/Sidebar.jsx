"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
    HiOfficeBuilding,
    HiCog,
    HiMenu,
    HiX,
    HiIdentification,
    HiQuestionMarkCircle,
    HiSpeakerphone,
    HiVideoCamera,
    HiCreditCard,
    HiLockOpen,
    HiChevronDown,
    HiChevronRight,
    HiChevronLeft,
} from "react-icons/hi";
import { HiDocumentCurrencyDollar, HiPresentationChartLine } from "react-icons/hi2";

import { logout } from "../../api/auth.client";
import { useUser } from "../providers/UserProvider";

const Sidebar = () => {
    const pathname = usePathname();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [desktopCollapsed, setDesktopCollapsed] = useState(false);
    const [collapsed, setCollapsed] = useState({});
    const { user } = useUser();

    // Navigation groups
    const navGroups = [
        {
            label: "Dashboard",
            items: [
                {
                    name: "Insight",
                    href: "/admin/insight",
                    icon: <HiPresentationChartLine className="h-6 w-6" />,
                },
            ],
        },
        {
            label: "Operations",
            items: [
                {
                    name: "Parking Lots",
                    href: "/admin/parking-lots",
                    icon: <HiOfficeBuilding className="h-6 w-6" />,
                },
                {
                    name: "Session Audit",
                    href: "/admin/audit",
                    icon: <HiDocumentCurrencyDollar className="h-6 w-6" />,
                },
                {
                    name: "Lost Tickets",
                    href: "/admin/lost-tickets",
                    icon: <HiQuestionMarkCircle className="h-6 w-6" />,
                },
            ],
        },
        {
            label: "Finance",
            items: [
                {
                    name: "Payments",
                    href: "/admin/payments",
                    icon: <HiDocumentCurrencyDollar className="h-6 w-6" />,
                },
                {
                    name: "Pricing Engine",
                    href: "/admin/fee-config",
                    icon: <HiCog className="h-6 w-6" />,
                    permission: "can_edit_fees",
                },
                {
                    name: "Checkout Settings",
                    href: "/admin/checkout-settings",
                    icon: <HiCreditCard className="h-6 w-6" />,
                },
            ],
        },
        {
            label: "Infrastructure",
            items: [
                {
                    name: "Card Pool",
                    href: "/admin/parking-cards",
                    icon: <HiCreditCard className="h-6 w-6" />,
                },
                {
                    name: "Cameras",
                    href: "/admin/cameras",
                    icon: <HiVideoCamera className="h-6 w-6" />,
                },
                {
                    name: "Gate Settings",
                    href: "/admin/gate-settings",
                    icon: <HiLockOpen className="h-6 w-6" />,
                },
            ],
        },
        {
            label: "Admin",
            items: [
                {
                    name: "Users",
                    href: "/admin/users",
                    icon: <HiIdentification className="h-6 w-6" />,
                },
                {
                    name: "Notifications",
                    href: "/admin/notifications",
                    icon: <HiSpeakerphone className="h-6 w-6" />,
                },
            ],
        },
    ];

    // Auto-collapse groups that don't contain the active page
    useEffect(() => {
        const activeGroup = navGroups.find((group) =>
            group.items.some((item) => pathname?.startsWith(item.href))
        );
        const initial = {};
        navGroups.forEach((group) => {
            if (group !== activeGroup) {
                initial[group.label] = true;
            }
        });
        setCollapsed(initial);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Only render on admin pages
    if (!pathname?.startsWith("/admin")) {
        return null;
    }

    // Close mobile sidebar when navigating
    useEffect(() => {
        setSidebarOpen(false);
    }, [pathname]);

    const isActive = (path) => pathname === path;

    // Render full navigation (mobile + desktop expanded)
    const renderNavigation = () => {
        return navGroups.map((group) => {
            const visibleItems = group.items.filter((item) => {
                if (item.permission) {
                    return !!user?.permissions?.[item.permission];
                }
                return true;
            });

            if (visibleItems.length === 0) return null;

            const isGroupCollapsed = !!collapsed[group.label];

            return (
                <div key={group.label} className="mt-3 first:mt-0">
                    <button
                        type="button"
                        onClick={() => setCollapsed((prev) => ({ ...prev, [group.label]: !prev[group.label] }))}
                        className="w-full flex items-center justify-between px-2 py-1 text-xs font-semibold uppercase tracking-wider text-slate-400 hover:text-slate-600"
                    >
                        {group.label}
                        {isGroupCollapsed ? (
                            <HiChevronRight className="h-4 w-4" />
                        ) : (
                            <HiChevronDown className="h-4 w-4" />
                        )}
                    </button>
                    {!isGroupCollapsed &&
                        visibleItems.map((item) => {
                            const active = isActive(item.href);
                            return (
                                <Link
                                    key={item.name}
                                    href={item.href}
                                    className={`group flex items-center px-2 py-2 text-base font-medium rounded-md ${
                                        active ? "bg-indigo-100 text-indigo-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-800"
                                    }`}
                                >
                                    <span className="mr-3">{item.icon}</span>
                                    {item.name}
                                </Link>
                            );
                        })}
                </div>
            );
        });
    };

    // Render icon-only navigation (desktop collapsed)
    const renderCollapsedNavigation = () => {
        return navGroups.map((group) => {
            const visibleItems = group.items.filter((item) => {
                if (item.permission) {
                    return !!user?.permissions?.[item.permission];
                }
                return true;
            });

            if (visibleItems.length === 0) return null;

            return (
                <div key={group.label} className="mt-2 first:mt-0">
                    {visibleItems.map((item) => {
                        const active = isActive(item.href);
                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                title={item.name}
                                className={`flex items-center justify-center p-2 rounded-md ${
                                    active ? "bg-indigo-100 text-indigo-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-800"
                                }`}
                            >
                                {item.icon}
                            </Link>
                        );
                    })}
                </div>
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
            <div className="sticky top-0 z-10 md:hidden pl-1 pt-1 sm:pl-3 sm:pt-3 bg-slate-100">
                <button
                    type="button"
                    className="-ml-0.5 -mt-0.5 h-12 w-12 inline-flex items-center justify-center rounded-md text-slate-500 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500"
                    onClick={() => setSidebarOpen(true)}
                >
                    <span className="sr-only">Open sidebar</span>
                    <HiMenu className="h-6 w-6" />
                </button>
            </div>

            {/* Mobile sidebar (drawer overlay) */}
            <div
                className="fixed inset-0 z-40 flex md:hidden"
                role="dialog"
                aria-modal="true"
                style={{ display: sidebarOpen ? "flex" : "none" }}
            >
                <div
                    className="fixed inset-0 bg-slate-600/75"
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
                            <Link href="/admin/insight" className="text-indigo-600 font-bold text-xl">Parking System</Link>
                        </div>
                        <nav className="mt-5 px-2 space-y-1">{renderNavigation()}</nav>
                    </div>
                    <div className="flex-shrink-0 flex border-t border-slate-200 p-4">
                        <button
                            onClick={handleLogout}
                            className="w-full bg-slate-200 hover:bg-slate-300 rounded-md px-3 py-2 text-sm font-medium text-slate-700"
                        >
                            Logout
                        </button>
                    </div>
                </div>
            </div>

            {/* Desktop sidebar — collapsible */}
            <div
                className="hidden md:block md:flex-none transition-all duration-200"
                style={{ width: desktopCollapsed ? "4rem" : "16rem" }}
            >
                <div
                    className="flex flex-col border-r border-slate-200 bg-white fixed top-0 bottom-0 transition-all duration-200"
                    style={{ width: desktopCollapsed ? "4rem" : "16rem" }}
                >
                    <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
                        {/* Logo / collapse toggle */}
                        <div className="flex items-center justify-between flex-shrink-0 px-3">
                            {!desktopCollapsed && (
                                <Link href="/admin/insight" className="text-indigo-600 font-bold text-xl">
                                    Parking System
                                </Link>
                            )}
                            <button
                                type="button"
                                onClick={() => setDesktopCollapsed((prev) => !prev)}
                                className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                                title={desktopCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                            >
                                {desktopCollapsed ? (
                                    <HiMenu className="h-5 w-5" />
                                ) : (
                                    <HiChevronLeft className="h-5 w-5" />
                                )}
                            </button>
                        </div>

                        {/* Navigation */}
                        <nav className="mt-5 flex-1 px-2 space-y-1">
                            {desktopCollapsed ? renderCollapsedNavigation() : renderNavigation()}
                        </nav>
                    </div>

                    {/* Footer */}
                    <div className="flex-shrink-0 border-t border-slate-200 p-3">
                        {!desktopCollapsed && (
                            <div className="mb-2">
                                <p className="text-sm font-medium text-slate-700 truncate">{user?.full_name}</p>
                                <p className="text-xs text-slate-500 truncate">{user?.username}</p>
                            </div>
                        )}
                        <button
                            onClick={handleLogout}
                            className={`bg-slate-200 hover:bg-slate-300 rounded-md text-sm font-medium text-slate-700 ${
                                desktopCollapsed ? "w-full p-2" : "w-full px-3 py-1"
                            }`}
                            title="Logout"
                        >
                            {desktopCollapsed ? <HiX className="h-5 w-5 mx-auto" /> : "Logout"}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};

export default Sidebar;
