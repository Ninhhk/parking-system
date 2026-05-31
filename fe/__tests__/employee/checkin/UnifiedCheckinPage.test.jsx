import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { act } from "react";

// --- Camera mock: forwardRef exposing a controllable capture() ---
// `mockCaptureFn` is read lazily inside capture(), so each test can swap the
// implementation (base64 string for success, null for a capture failure).
let mockCaptureFn;
jest.mock("@/app/employee/checkin/components/KioskCameraPanel", () => {
    const React = require("react");
    return {
        __esModule: true,
        default: React.forwardRef(function MockKioskCameraPanel(_, ref) {
            React.useImperativeHandle(ref, () => ({
                capture: () => mockCaptureFn(),
            }));
            return React.createElement("div", { "data-testid": "camera-panel" });
        }),
    };
});

jest.mock("@/app/api/employee.client", () => ({
    getGatewayLaneConfig: jest.fn(),
    getSubscriptionByCard: jest.fn(),
    checkInByRfid: jest.fn(),
    checkInVehicle: jest.fn(),
    fetchMyLot: jest.fn(),
}));

jest.mock("@/app/api/employee.lpd.client", () => ({
    detectLicensePlate: jest.fn(),
}));

import UnifiedCheckinPage from "@/app/employee/checkin/page";
import {
    getGatewayLaneConfig,
    getSubscriptionByCard,
    checkInByRfid,
    checkInVehicle,
    fetchMyLot,
} from "@/app/api/employee.client";
import { detectLicensePlate } from "@/app/api/employee.lpd.client";

const BASE64_IMG = "data:image/jpeg;base64,AAAA";

// A rejection shaped like an axios 404 (what the API clients surface)
const reject404 = () => Promise.reject({ response: { status: 404 } });

/**
 * Render the page and flush the two on-mount fetches (lane config + lot read)
 * so `laneConfig` and `casualMode` are committed before any interaction.
 */
async function renderPage() {
    const utils = render(<UnifiedCheckinPage />);
    await waitFor(() => {
        expect(getGatewayLaneConfig).toHaveBeenCalled();
        expect(fetchMyLot).toHaveBeenCalled();
    });
    // Flush the resolved-promise state updates (setLaneConfig / setCasualMode)
    await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
    });
    return utils;
}

function tapCard(uid) {
    const input = screen.getByLabelText(/RFID Card UID/i);
    fireEvent.change(input, { target: { value: uid } });
    fireEvent.keyDown(input, { key: "Enter" });
}

const casualButton = () => screen.getByRole("button", { name: /casual entry/i });

beforeEach(() => {
    jest.clearAllMocks();
    mockCaptureFn = jest.fn(() => BASE64_IMG);

    // Sensible defaults; individual tests override as needed.
    getGatewayLaneConfig.mockResolvedValue({
        allowed_trigger_modules: [],
        vehicle_type: "bike",
        has_camera: true,
        lane_direction: "in",
    });
    fetchMyLot.mockResolvedValue({ casual_entry_mode: "session_ticket" });
    checkInByRfid.mockResolvedValue({ ticket: { session_id: 1 } });
    checkInVehicle.mockResolvedValue({ ticket: { session_id: 1 } });
    detectLicensePlate.mockResolvedValue({ normalized_plate: "ABC-123" });
});

describe("UnifiedCheckinPage", () => {
    // 1. Renders panels on mount; casual control depends on mode
    it("renders the core panels and shows the casual control in session_ticket mode", async () => {
        fetchMyLot.mockResolvedValue({ casual_entry_mode: "session_ticket" });

        await renderPage();

        expect(screen.getByText(/RFID Reader Terminal/i)).toBeInTheDocument();
        expect(screen.getByText(/Barrier Gate/i)).toBeInTheDocument();
        expect(screen.getByTestId("camera-panel")).toBeInTheDocument();
        // CasualEntryControl is rendered only in session_ticket mode
        expect(casualButton()).toBeInTheDocument();
    });

    it("hides the casual control in issued_card mode", async () => {
        fetchMyLot.mockResolvedValue({ casual_entry_mode: "issued_card" });

        await renderPage();

        expect(screen.getByText(/RFID Reader Terminal/i)).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /casual entry/i })).not.toBeInTheDocument();
    });

    // 2. Subscriber tap-and-go
    it("processes a subscriber tap-and-go: checkInByRfid with the sub's vehicle_type, gate opens", async () => {
        getSubscriptionByCard.mockResolvedValue({ owner_name: "Alice", vehicle_type: "car" });

        await renderPage();
        tapCard("CARD-001");

        await waitFor(() => expect(checkInByRfid).toHaveBeenCalled());
        expect(checkInByRfid).toHaveBeenCalledWith(
            expect.objectContaining({ card_uid: "CARD-001", vehicle_type: "car" })
        );
        expect(checkInVehicle).not.toHaveBeenCalled();
        await waitFor(() => expect(screen.getByText("Gate open")).toBeInTheDocument());
    });

    // 3. Unknown card, session_ticket mode -> denied, gate shut, no check-in
    it("denies an unknown card in session_ticket mode without calling any check-in", async () => {
        getSubscriptionByCard.mockImplementation(reject404);
        fetchMyLot.mockResolvedValue({ casual_entry_mode: "session_ticket" });

        await renderPage();
        tapCard("CARD-404");

        await waitFor(() => expect(screen.getByText("Card not recognized")).toBeInTheDocument());
        expect(checkInByRfid).not.toHaveBeenCalled();
        expect(checkInVehicle).not.toHaveBeenCalled();
        expect(screen.getByText("Gate closed")).toBeInTheDocument();
    });

    // 4. Issued-card casual: 404 sub + fixed lane vehicle_type
    it("creates an issued-card casual entry with card_uid and entry_type=casual", async () => {
        getSubscriptionByCard.mockImplementation(reject404);
        fetchMyLot.mockResolvedValue({ casual_entry_mode: "issued_card" });
        getGatewayLaneConfig.mockResolvedValue({
            allowed_trigger_modules: [],
            vehicle_type: "car",
            has_camera: true,
            lane_direction: "in",
        });

        await renderPage();
        tapCard("POOL-007");

        await waitFor(() => expect(checkInVehicle).toHaveBeenCalled());
        const payload = checkInVehicle.mock.calls[0][0];
        expect(payload.card_uid).toBe("POOL-007");
        expect(payload.vehicle_type).toBe("car");
        expect(payload.metadata_in.entry_type).toBe("casual");
        expect(checkInByRfid).not.toHaveBeenCalled();
    });

    // 5. Session-ticket casual on a fixed lane -> no card_uid
    it("creates a session-ticket casual entry with no card_uid and entry_type=casual", async () => {
        fetchMyLot.mockResolvedValue({ casual_entry_mode: "session_ticket" });
        getGatewayLaneConfig.mockResolvedValue({
            allowed_trigger_modules: [],
            vehicle_type: "bike",
            has_camera: true,
            lane_direction: "in",
        });

        await renderPage();
        fireEvent.click(casualButton());

        await waitFor(() => expect(checkInVehicle).toHaveBeenCalled());
        const payload = checkInVehicle.mock.calls[0][0];
        expect(payload.card_uid).toBeUndefined();
        expect(payload.vehicle_type).toBe("bike");
        expect(payload.metadata_in.entry_type).toBe("casual");
    });

    // 6. Mixed lane requires a vehicle pick before submitting
    it("requires a vehicle pick on a mixed lane before submitting a casual entry", async () => {
        fetchMyLot.mockResolvedValue({ casual_entry_mode: "session_ticket" });
        getGatewayLaneConfig.mockResolvedValue({
            allowed_trigger_modules: [],
            vehicle_type: null, // mixed lane
            has_camera: true,
            lane_direction: "in",
        });

        await renderPage();
        fireEvent.click(casualButton());

        // VehicleFormPanel appears, nothing submitted yet
        await waitFor(() => expect(screen.getByText(/Select vehicle type for this entry/i)).toBeInTheDocument());
        expect(checkInVehicle).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole("button", { name: /car/i }));

        await waitFor(() => expect(checkInVehicle).toHaveBeenCalled());
        const payload = checkInVehicle.mock.calls[0][0];
        expect(payload.vehicle_type).toBe("car");
        expect(payload.card_uid).toBeUndefined();
        expect(payload.metadata_in.entry_type).toBe("casual");
    });

    // 7. No camera configured -> no_camera_evidence flag
    it("flags no_camera_evidence when the lane has no camera", async () => {
        fetchMyLot.mockResolvedValue({ casual_entry_mode: "session_ticket" });
        getGatewayLaneConfig.mockResolvedValue({
            allowed_trigger_modules: [],
            vehicle_type: "bike",
            has_camera: false,
            lane_direction: "in",
        });

        await renderPage();
        fireEvent.click(casualButton());

        await waitFor(() => expect(checkInVehicle).toHaveBeenCalled());
        const payload = checkInVehicle.mock.calls[0][0];
        expect(payload.metadata_in.no_camera_evidence).toBe(true);
        // capture() should not be invoked when no camera is configured
        expect(mockCaptureFn).not.toHaveBeenCalled();
    });

    // 8. Capture failure -> capture-failed state; "Proceed without image" submits with the flag
    it("enters capture-failed state and only submits after the operator proceeds without image", async () => {
        fetchMyLot.mockResolvedValue({ casual_entry_mode: "session_ticket" });
        getGatewayLaneConfig.mockResolvedValue({
            allowed_trigger_modules: [],
            vehicle_type: "bike",
            has_camera: true, // camera configured...
            lane_direction: "in",
        });
        mockCaptureFn = jest.fn(() => null); // ...but capture fails

        await renderPage();
        fireEvent.click(casualButton());

        // Block: capture-failed resolution surfaces, nothing submitted
        await waitFor(() =>
            expect(screen.getByRole("button", { name: /proceed without image/i })).toBeInTheDocument()
        );
        expect(checkInVehicle).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole("button", { name: /proceed without image/i }));

        await waitFor(() => expect(checkInVehicle).toHaveBeenCalled());
        const payload = checkInVehicle.mock.calls[0][0];
        expect(payload.metadata_in.no_camera_evidence).toBe(true);
    });
});
