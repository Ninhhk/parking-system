import { renderHook, act } from "@testing-library/react";
import { useScanRouter } from "@/app/employee/dual-lane/hooks/useScanRouter";

// Helper: simulate rapid keydown events on document
function fireKeys(keys, options = {}) {
    const { delay = 0 } = options;
    keys.forEach((key, i) => {
        if (delay && i > 0) {
            jest.advanceTimersByTime(delay);
        }
        const event = new KeyboardEvent("keydown", {
            key,
            bubbles: true,
        });
        document.dispatchEvent(event);
    });
}

function fireKeysOnTarget(target, keys) {
    keys.forEach((key) => {
        const event = new KeyboardEvent("keydown", {
            key,
            bubbles: true,
        });
        Object.defineProperty(event, "target", { value: target, writable: false });
        document.dispatchEvent(event);
    });
}

describe("useScanRouter", () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    const defaultConfig = {
        entryPrefix: "I:",
        exitPrefix: "O:",
        enabled: true,
    };

    it("routes entry-prefixed scan to lastEntryScan", () => {
        const { result } = renderHook(() => useScanRouter(defaultConfig));

        act(() => {
            fireKeys(["I", ":", "C", "A", "R", "D", "1", "Enter"]);
        });

        expect(result.current.lastEntryScan).toBe("CARD1");
        expect(result.current.lastExitScan).toBeNull();
    });

    it("routes exit-prefixed scan to lastExitScan", () => {
        const { result } = renderHook(() => useScanRouter(defaultConfig));

        act(() => {
            fireKeys(["O", ":", "A", "B", "C", "D", "Enter"]);
        });

        expect(result.current.lastExitScan).toBe("ABCD");
        expect(result.current.lastEntryScan).toBeNull();
    });

    it("ignores scan with unknown prefix", () => {
        const { result } = renderHook(() => useScanRouter(defaultConfig));

        act(() => {
            fireKeys(["X", ":", "C", "A", "R", "D", "Enter"]);
        });

        expect(result.current.lastEntryScan).toBeNull();
        expect(result.current.lastExitScan).toBeNull();
    });

    it("ignores scan with no card_uid after prefix", () => {
        const { result } = renderHook(() => useScanRouter(defaultConfig));

        act(() => {
            fireKeys(["I", ":", "Enter"]);
        });

        expect(result.current.lastEntryScan).toBeNull();
    });

    it("resets buffer after 200ms inter-keystroke gap", () => {
        const { result } = renderHook(() => useScanRouter(defaultConfig));

        act(() => {
            fireKeys(["I", ":"]);
            // Advance time beyond 200ms timeout
            jest.advanceTimersByTime(250);
            // Continue typing after timeout — buffer was reset
            fireKeys(["C", "A", "R", "D", "Enter"]);
        });

        // "CARD" doesn't start with any prefix → ignored
        expect(result.current.lastEntryScan).toBeNull();
        expect(result.current.lastExitScan).toBeNull();
    });

    it("does not reset buffer when keystrokes are within 200ms", () => {
        const { result } = renderHook(() => useScanRouter(defaultConfig));

        act(() => {
            // Simulate rapid typing (50ms gaps — well within 200ms timeout)
            fireKeys(["I", ":", "C", "A", "R", "D", "Enter"], { delay: 50 });
        });

        expect(result.current.lastEntryScan).toBe("CARD");
    });

    it("sets configError when prefixes are the same", () => {
        const { result } = renderHook(() =>
            useScanRouter({ entryPrefix: "I:", exitPrefix: "I:", enabled: true })
        );

        expect(result.current.configError).toBe("Entry and exit prefixes must be different");
    });

    it("sets configError when prefix is empty", () => {
        const { result } = renderHook(() =>
            useScanRouter({ entryPrefix: "", exitPrefix: "O:", enabled: true })
        );

        expect(result.current.configError).toBe("Entry and exit prefixes must be configured");
    });

    it("does not process scans when disabled", () => {
        const { result } = renderHook(() =>
            useScanRouter({ ...defaultConfig, enabled: false })
        );

        act(() => {
            fireKeys(["I", ":", "C", "A", "R", "D", "Enter"]);
        });

        expect(result.current.lastEntryScan).toBeNull();
    });

    it("does not process scans when configError exists", () => {
        const { result } = renderHook(() =>
            useScanRouter({ entryPrefix: "I:", exitPrefix: "I:", enabled: true })
        );

        act(() => {
            fireKeys(["I", ":", "C", "A", "R", "D", "Enter"]);
        });

        expect(result.current.lastEntryScan).toBeNull();
    });

    it("resetEntry clears lastEntryScan", () => {
        const { result } = renderHook(() => useScanRouter(defaultConfig));

        act(() => {
            fireKeys(["I", ":", "T", "E", "S", "T", "Enter"]);
        });
        expect(result.current.lastEntryScan).toBe("TEST");

        act(() => {
            result.current.resetEntry();
        });
        expect(result.current.lastEntryScan).toBeNull();
    });

    it("resetExit clears lastExitScan", () => {
        const { result } = renderHook(() => useScanRouter(defaultConfig));

        act(() => {
            fireKeys(["O", ":", "T", "E", "S", "T", "Enter"]);
        });
        expect(result.current.lastExitScan).toBe("TEST");

        act(() => {
            result.current.resetExit();
        });
        expect(result.current.lastExitScan).toBeNull();
    });

    it("ignores keystrokes from input elements", () => {
        const { result } = renderHook(() => useScanRouter(defaultConfig));

        const input = document.createElement("input");
        document.body.appendChild(input);

        act(() => {
            fireKeysOnTarget(input, ["I", ":", "C", "A", "R", "D", "Enter"]);
        });

        expect(result.current.lastEntryScan).toBeNull();
        document.body.removeChild(input);
    });

    it("handles consecutive scans on both lanes", () => {
        const { result } = renderHook(() => useScanRouter(defaultConfig));

        act(() => {
            fireKeys(["I", ":", "A", "A", "A", "Enter"]);
        });
        expect(result.current.lastEntryScan).toBe("AAA");

        act(() => {
            fireKeys(["O", ":", "B", "B", "B", "Enter"]);
        });
        expect(result.current.lastExitScan).toBe("BBB");
        // Entry scan remains until reset
        expect(result.current.lastEntryScan).toBe("AAA");
    });

    it("cleans up listener on unmount", () => {
        const spy = jest.spyOn(document, "removeEventListener");
        const { unmount } = renderHook(() => useScanRouter(defaultConfig));

        unmount();

        expect(spy).toHaveBeenCalledWith("keydown", expect.any(Function));
        spy.mockRestore();
    });

    it("ignores Enter with empty buffer", () => {
        const { result } = renderHook(() => useScanRouter(defaultConfig));

        act(() => {
            fireKeys(["Enter"]);
        });

        expect(result.current.lastEntryScan).toBeNull();
        expect(result.current.lastExitScan).toBeNull();
    });
});
