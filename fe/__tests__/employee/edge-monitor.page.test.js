import { render, waitFor } from "@testing-library/react";
import { act } from "react";

import EdgeMonitorPage from "@/app/employee/edge-monitor/page";

const replaceMock = jest.fn();
const toastErrorMock = jest.fn();
const toastSuccessMock = jest.fn();

jest.mock("next/navigation", () => ({
    useRouter: () => ({ replace: replaceMock }),
    usePathname: () => "/employee/edge-monitor",
    useSearchParams: () => ({
        toString: () => "",
    }),
}));

jest.mock("@/app/api/edge.client", () => ({
    fetchEdgeEvents: jest.fn(),
    fetchEdgeActiveSessions: jest.fn(),
    retryEdgeEvent: jest.fn(),
}));

jest.mock("@/app/components/providers/ToastProvider", () => ({
    useToast: () => ({
        error: toastErrorMock,
        success: toastSuccessMock,
    }),
}));

import {
    fetchEdgeEvents,
    fetchEdgeActiveSessions,
} from "@/app/api/edge.client";

describe("edge monitor page", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        fetchEdgeEvents.mockImplementation(async () => ({
            rows: [{ event_id: String(Date.now()) }],
        }));
        fetchEdgeActiveSessions.mockImplementation(async () => ({
            rows: [{ session_id: Date.now() }],
        }));
    });

    it("does not refetch continuously when query string is unchanged", async () => {
        render(<EdgeMonitorPage />);

        await waitFor(() => {
            expect(fetchEdgeEvents).toHaveBeenCalled();
            expect(fetchEdgeActiveSessions).toHaveBeenCalled();
        });

        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 60));
        });

        await waitFor(() => {
            expect(fetchEdgeEvents).toHaveBeenCalledTimes(1);
            expect(fetchEdgeActiveSessions).toHaveBeenCalledTimes(1);
        });
    });
});
