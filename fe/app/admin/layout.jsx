import Sidebar from "../components/admin/Sidebar";

/**
 * Admin layout wrapper with sidebar
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children - Page content
 */
export default function AdminLayout({ children }) {
    return (
        <div style={{ display: "flex" }}>
            <Sidebar />
            <div style={{ flex: 1, padding: 24 }}>{children}</div>
        </div>
    );
}
