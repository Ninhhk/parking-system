import Sidebar from "../components/admin/Sidebar";

export const metadata = {
    title: "Parking System - Admin",
};

/**
 * Admin layout wrapper with sidebar
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children - Page content
 */
export default function AdminLayout({ children }) {
    return (
        <div className="flex min-h-screen">
            <Sidebar />
            <div className="flex-1 p-6 overflow-auto">{children}</div>
        </div>
    );
}
