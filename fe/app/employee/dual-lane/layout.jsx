/**
 * Dual-lane kiosk layout — full-width, no extra padding.
 * Reuses employee auth from the parent layout but reduces spacing
 * for the split-screen kiosk experience.
 */
export default function DualLaneLayout({ children }) {
    return (
        <div className="flex-1 w-full h-full overflow-hidden">
            {children}
        </div>
    );
}
