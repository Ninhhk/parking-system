import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ParkingCardsPage from "@/app/admin/parking-cards/page";

// ─── Mocks ─────────────────────────────────────────────────────────────────
// The page renders the real useParkingCards hook, DataTable, Modal, and form;
// only the API client and toast are mocked (mirrors fee-config.page.test.js).

const mockFetchParkingCards = jest.fn();
const mockFetchCardInventory = jest.fn();
const mockFetchParkingLots = jest.fn();
const mockAddParkingCard = jest.fn();
const mockSetParkingCardStatus = jest.fn();
const mockDeleteParkingCard = jest.fn();

jest.mock("@/app/api/admin.client", () => ({
    fetchParkingCards: (...args) => mockFetchParkingCards(...args),
    fetchCardInventory: (...args) => mockFetchCardInventory(...args),
    fetchParkingLots: (...args) => mockFetchParkingLots(...args),
    addParkingCard: (...args) => mockAddParkingCard(...args),
    setParkingCardStatus: (...args) => mockSetParkingCardStatus(...args),
    deleteParkingCard: (...args) => mockDeleteParkingCard(...args),
}));

const mockToastError = jest.fn();
jest.mock("react-hot-toast", () => ({
    toast: { error: (...args) => mockToastError(...args) },
}));

// ─── Test data ───────────────────────────────────────────────────────────────

const cards = [
    {
        card_uid: "POOL-001",
        lot_id: 1,
        lot_name: "Lot A",
        status: "available",
        created_at: "2026-01-01T00:00:00.000Z",
    },
    {
        // Shared card: lot_id null → Assigned Lot should render "Shared" (Req 1.3)
        card_uid: "SHARED-9",
        lot_id: null,
        lot_name: null,
        status: "available",
        created_at: "2026-01-02T00:00:00.000Z",
    },
];

const inventory = { total: 2, available: 2, lost: 0 };
const lots = [{ lot_id: 1, lot_name: "Lot A" }];

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("ParkingCardsPage", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockFetchParkingCards.mockResolvedValue(cards);
        mockFetchCardInventory.mockResolvedValue(inventory);
        mockFetchParkingLots.mockResolvedValue(lots);
    });

    // 1.1 — table renders the four required columns
    it("renders the table with Card UID, Assigned Lot, Status, and Created At columns", async () => {
        render(<ParkingCardsPage />);

        await waitFor(() => {
            expect(screen.getByText("POOL-001")).toBeInTheDocument();
        });

        expect(screen.getByText("Card UID")).toBeInTheDocument();
        expect(screen.getByText("Assigned Lot")).toBeInTheDocument();
        expect(screen.getByText("Status")).toBeInTheDocument();
        expect(screen.getByText("Created At")).toBeInTheDocument();
    });

    // 1.3 — a card with lot_id null shows "Shared" in the Assigned Lot column
    it("renders the Assigned Lot as \"Shared\" for a card whose lot_id is null", async () => {
        render(<ParkingCardsPage />);

        await waitFor(() => {
            expect(screen.getByText("SHARED-9")).toBeInTheDocument();
        });

        // The shared card renders "Shared"; the lot-bound card keeps its lot name.
        expect(screen.getByText("Shared")).toBeInTheDocument();
        expect(screen.getByText("Lot A")).toBeInTheDocument();
    });

    // 3.4 — a delete that returns 409 surfaces a toast.error
    it("shows a toast error when deleting a card that returns 409 (card in use)", async () => {
        const confirmSpy = jest.spyOn(window, "confirm").mockReturnValue(true);
        mockDeleteParkingCard.mockRejectedValue({ response: { status: 409 } });

        render(<ParkingCardsPage />);

        await waitFor(() => {
            expect(screen.getByText("POOL-001")).toBeInTheDocument();
        });

        // DataTable renders a Delete button per row; the first row is POOL-001.
        const deleteButtons = screen.getAllByText("Delete");
        fireEvent.click(deleteButtons[0]);

        await waitFor(() => {
            expect(mockToastError).toHaveBeenCalledWith("Card is in use and cannot be deleted");
        });

        expect(mockDeleteParkingCard).toHaveBeenCalledWith("POOL-001");

        confirmSpy.mockRestore();
    });
});
