import { render, screen } from "@testing-library/react";

import Navbar from "@/app/components/employee/Navbar";

jest.mock("next/navigation", () => ({
    usePathname: () => "/employee/checkin",
}));

jest.mock("@/app/api/auth.client", () => ({
    logout: jest.fn(),
}));

jest.mock("@/app/components/providers/UserProvider", () => ({
    useUser: () => ({ user: { full_name: "Test Operator", username: "operator" } }),
}));

describe("employee Navbar navigation items", () => {
    // Validates: Requirements 7.1
    it("does not render an 'RFID Kiosk' navigation item", () => {
        render(<Navbar />);

        expect(screen.queryByText(/RFID Kiosk/i)).not.toBeInTheDocument();
    });

    // Validates: Requirements 7.2
    it("renders a 'Check-in' link pointing to /employee/checkin", () => {
        render(<Navbar />);

        // Desktop and mobile lists both render a "Check-in" link; assert at least
        // one exists and every one points to the unified route.
        const checkinLinks = screen.getAllByRole("link", { name: /Check-in/i });

        expect(checkinLinks.length).toBeGreaterThan(0);
        checkinLinks.forEach((link) => {
            expect(link).toHaveAttribute("href", "/employee/checkin");
        });
    });
});
