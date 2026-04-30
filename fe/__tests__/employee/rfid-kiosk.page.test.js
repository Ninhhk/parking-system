import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import RfidKioskPage from "@/app/employee/checkin/rfid/page";

const mockCheckInByRfid = jest.fn();
const mockGetRfidKioskFlags = jest.fn();

jest.mock("@/app/api/employee.client", () => ({
    checkInByRfid: (...args) => mockCheckInByRfid(...args),
}));

jest.mock("@/app/employee/checkin/rfid/flags", () => ({
    getRfidKioskFlags: (...args) => mockGetRfidKioskFlags(...args),
}));

const ENABLED_FLAGS = {
    READER: true,
    VEHICLE_FORM: true,
    RESULT: true,
    GATE_STATUS: true,
    RECENT_EVENTS: true,
};

describe("rfid kiosk check-in page", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockGetRfidKioskFlags.mockReturnValue(ENABLED_FLAGS);
    });

    it("safe-fails when required modules are disabled", () => {
        mockGetRfidKioskFlags.mockReturnValue({
            ...ENABLED_FLAGS,
            READER: false,
        });

        render(<RfidKioskPage />);

        expect(screen.getByText("RFID kiosk configuration error")).toBeInTheDocument();
        expect(screen.getByText(/missing required modules/i)).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /check in with rfid/i })).not.toBeInTheDocument();
    });

    it("starts in idle state", () => {
        render(<RfidKioskPage />);

        expect(screen.getByText("Ready to scan")).toBeInTheDocument();
        expect(screen.getByText("Gate closed")).toBeInTheDocument();
    });

    it("keeps submit disabled for whitespace-only UID", () => {
        render(<RfidKioskPage />);

        fireEvent.change(screen.getByLabelText(/rfid card uid/i), {
            target: { value: "   " },
        });

        expect(screen.getByRole("button", { name: /check in with rfid/i })).toBeDisabled();
    });

    it("submits RFID payload and transitions to success", async () => {
        mockCheckInByRfid.mockResolvedValue({
            success: true,
            ticket: {
                session_id: 101,
                card_uid: "CARD-101",
                vehicle_type: "bike",
            },
        });

        render(<RfidKioskPage />);

        fireEvent.change(screen.getByLabelText(/rfid card uid/i), {
            target: { value: "CARD-101" },
        });
        fireEvent.click(screen.getByLabelText(/bike/i));
        fireEvent.click(screen.getByRole("button", { name: /check in with rfid/i }));

        expect(screen.getByText("Scanning card...")).toBeInTheDocument();

        await waitFor(() => {
            expect(screen.getByText("Access granted")).toBeInTheDocument();
        });

        expect(mockCheckInByRfid).toHaveBeenCalledWith({
            card_uid: "CARD-101",
            vehicle_type: "bike",
        });
        expect(screen.getByText("Session #101")).toBeInTheDocument();
        expect(screen.getByText(/success.*CARD-101/i)).toBeInTheDocument();
        expect(screen.getByText("Gate open")).toBeInTheDocument();
    });

    it("prevents duplicate submission while scanning", async () => {
        let resolveRequest;
        mockCheckInByRfid.mockImplementation(
            () =>
                new Promise((resolve) => {
                    resolveRequest = resolve;
                }),
        );

        render(<RfidKioskPage />);

        fireEvent.change(screen.getByLabelText(/rfid card uid/i), {
            target: { value: "CARD-ONCE" },
        });

        const button = screen.getByRole("button", { name: /check in with rfid/i });
        fireEvent.click(button);
        fireEvent.click(button);

        expect(mockCheckInByRfid).toHaveBeenCalledTimes(1);

        resolveRequest({ success: true, ticket: { session_id: 1 } });
        await waitFor(() => expect(screen.getByText("Access granted")).toBeInTheDocument());
    });

    it("maps API status 409 to denied state", async () => {
        mockCheckInByRfid.mockRejectedValue({
            response: {
                status: 409,
                data: {
                    message: "This vehicle already has an active session",
                },
            },
        });

        render(<RfidKioskPage />);

        fireEvent.change(screen.getByLabelText(/rfid card uid/i), {
            target: { value: "CARD-409" },
        });
        fireEvent.click(screen.getByRole("button", { name: /check in with rfid/i }));

        await waitFor(() => {
            expect(screen.getByText("Access denied")).toBeInTheDocument();
        });

        expect(screen.getByText("This vehicle already has an active session")).toBeInTheDocument();
    });

    it.each([422, 404, 500, undefined])(
        "maps API status %p to error state",
        async (statusCode) => {
            mockCheckInByRfid.mockRejectedValue({
                response: {
                    status: statusCode,
                    data: {
                        message: "Unable to process RFID check-in",
                    },
                },
            });

            render(<RfidKioskPage />);

            fireEvent.change(screen.getByLabelText(/rfid card uid/i), {
                target: { value: `CARD-${statusCode || "UNKNOWN"}` },
            });
            fireEvent.click(screen.getByRole("button", { name: /check in with rfid/i }));

            await waitFor(() => {
                expect(screen.getByText("System error")).toBeInTheDocument();
            });
        },
    );
});
