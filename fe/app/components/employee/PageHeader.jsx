"use client";

import { useFullscreen } from "@/app/hooks/useFullscreen";
import { MdFullscreen, MdFullscreenExit } from "react-icons/md";

/**
 * Shared page header for employee section pages.
 * Displays a unique page identity (title, subtitle, icon/accent)
 * and optionally a fullscreen toggle button.
 *
 * @param {Object} props
 * @param {string} props.title - Unique page title
 * @param {string} props.subtitle - One-line purpose description
 * @param {React.ReactNode} props.icon - Distinguishing icon element
 * @param {string} props.accentColor - Tailwind color name (e.g., "blue", "amber", "indigo")
 * @param {boolean} [props.showFullscreen=false] - Whether to show fullscreen toggle
 */
export default function PageHeader({ title, subtitle, icon, accentColor, showFullscreen = false }) {
    const { isFullscreen, toggle, supported } = useFullscreen();

    // Build accent class with a map to avoid Tailwind purge issues with dynamic classes
    const accentBgMap = {
        blue: "bg-blue-600",
        amber: "bg-amber-600",
        indigo: "bg-indigo-600",
    };
    const accentBg = accentBgMap[accentColor] || "bg-gray-600";

    return (
        <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
                <div className={`${accentBg} text-white rounded-lg p-2.5 flex items-center justify-center`}>
                    {icon}
                </div>
                <div>
                    <h1 className="text-xl font-bold text-gray-800">{title}</h1>
                    <p className="text-sm text-gray-500">{subtitle}</p>
                </div>
            </div>

            {showFullscreen && supported && (
                <button
                    onClick={toggle}
                    aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                    className="p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                    {isFullscreen ? (
                        <MdFullscreenExit className="h-5 w-5" />
                    ) : (
                        <MdFullscreen className="h-5 w-5" />
                    )}
                </button>
            )}
        </div>
    );
}
