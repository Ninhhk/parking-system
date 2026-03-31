import Sidebar from "../components/employee/Sidebar";

/**
 * Admin layout wrapper with sidebar
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children - Page content
 */
export default function EmployeeLayout({ children }) {
        return (
        <section style={{ display: "flex", flex: 1 }} className="flex-1 w-full h-full">
                <Sidebar />
                <div style={{ flex: 1, padding: 24, display: "flex", flexDirection: "column" }}>{children}</div>
        </section>
    );
}
