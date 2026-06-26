"use client";

/**
 * Visual flash/highlight wrapper — briefly highlights the panel border
 * when a scan is received to indicate which side was activated.
 *
 * @param {{ active: boolean, color: "green"|"blue", children: React.ReactNode }} props
 */
export default function ScanIndicator({ active, color = "green", children }) {
    const borderColor = color === "green"
        ? "border-green-400 shadow-green-200"
        : "border-blue-400 shadow-blue-200";

    return (
        <div
            className={`h-full transition-all duration-300 border-2 rounded-sm ${
                active
                    ? `${borderColor} shadow-lg`
                    : "border-transparent"
            }`}
        >
            {children}
        </div>
    );
}
