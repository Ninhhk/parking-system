"use client";

import { useRef, useEffect } from "react";
import Link from "next/link";
import { HiBell } from "react-icons/hi";

/**
 * BellPreview - Dropdown overlay showing recent notifications.
 * Triggered by the bell icon in Navbar.
 *
 * @param {Object} props
 * @param {boolean} props.open - Whether dropdown is visible
 * @param {Array|null|undefined} props.notifications - Recent notification items
 * @param {() => void} props.onClose - Close handler
 */
export default function BellPreview({ open, notifications, onClose }) {
    const dropdownRef = useRef(null);

    // Close on outside click
    useEffect(() => {
        if (!open) return;

        function handleClickOutside(event) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                onClose();
            }
        }

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [open, onClose]);

    // Close on Escape key
    useEffect(() => {
        if (!open) return;

        function handleKeyDown(event) {
            if (event.key === "Escape") {
                onClose();
            }
        }

        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [open, onClose]);

    if (!open) return null;

    const isUnavailable = notifications == null;
    const items = isUnavailable ? [] : notifications.slice(0, 5);

    function formatTimestamp(isoString) {
        try {
            const date = new Date(isoString);
            return date.toLocaleString("vi-VN", {
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
            });
        } catch {
            return "";
        }
    }

    function truncateMessage(message, maxLength = 60) {
        if (!message) return "";
        return message.length > maxLength
            ? message.slice(0, maxLength) + "…"
            : message;
    }

    return (
        <div
            ref={dropdownRef}
            className="absolute right-0 top-full mt-2 w-80 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden"
            role="menu"
        >
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                <HiBell className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-semibold text-slate-700">Notifications</span>
            </div>

            {/* Content */}
            {isUnavailable ? (
                <div className="px-4 py-6 text-center text-sm text-gray-500">
                    Unable to load notifications.
                </div>
            ) : items.length === 0 ? (
                <div className="px-4 py-6 text-center text-sm text-gray-500">
                    No recent notifications.
                </div>
            ) : (
                <ul className="divide-y divide-gray-100 max-h-72 overflow-y-auto">
                    {items.map((notification) => (
                        <li
                            key={notification.noti_id}
                            className="px-4 py-3 hover:bg-gray-50 transition-colors"
                        >
                            <p className="text-sm font-medium text-slate-800 leading-tight">
                                {notification.title}
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5 leading-snug">
                                {truncateMessage(notification.message)}
                            </p>
                            <p className="text-[10px] text-gray-400 mt-1">
                                {formatTimestamp(notification.created_at)}
                            </p>
                        </li>
                    ))}
                </ul>
            )}

            {/* Footer */}
            <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50/50">
                <Link
                    href="/employee/notifications"
                    className="block text-center text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
                    onClick={onClose}
                >
                    View All Alerts
                </Link>
            </div>
        </div>
    );
}
