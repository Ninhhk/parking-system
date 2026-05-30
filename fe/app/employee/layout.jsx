import Navbar from "../components/employee/Navbar";

/**
 * Admin layout wrapper with top navbar
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children - Page content
 */
export default function EmployeeLayout({ children }) {
    return (
        <div className="flex flex-col min-h-screen bg-slate-50 w-full h-full flex-1">
            <Navbar />
            <div style={{ flex: 1, padding: 24, display: "flex", flexDirection: "column" }} className="flex-1 w-full h-full">
                {children}
            </div>
        </div>
    );
}
