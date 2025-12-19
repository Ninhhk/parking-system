import Sidebar from "../components/employee/Sidebar";

/**
 * Admin layout wrapper with sidebar
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children - Page content
 */
export default function EmployeeLayout({ children }) {
        return (
        <div style={{ display: "flex" }}>
                <Sidebar />
                <div style={{ flex: 1, padding: 24 }}>{children}</div>
        </div>
    );
}
