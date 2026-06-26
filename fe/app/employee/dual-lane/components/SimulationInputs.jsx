"use client";

import { useRef } from "react";

/**
 * Simulation mode inputs — two labeled text fields that substitute
 * for physical USB HID readers. Operator types a card_uid and presses
 * Enter to simulate a scan.
 *
 * @param {{ onEntryScan: (uid: string) => void, onExitScan: (uid: string) => void }} props
 */
export default function SimulationInputs({ onEntryScan, onExitScan }) {
    const entryRef = useRef(null);
    const exitRef = useRef(null);

    const handleEntryKey = (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            const val = entryRef.current.value.trim();
            if (val) {
                onEntryScan(val);
                entryRef.current.value = "";
            }
        }
    };

    const handleExitKey = (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            const val = exitRef.current.value.trim();
            if (val) {
                onExitScan(val);
                exitRef.current.value = "";
            }
        }
    };

    return (
        <div className="flex gap-4 px-4 py-2 bg-yellow-50 border-b border-yellow-200">
            <div className="flex-1 flex items-center gap-2">
                <label className="text-sm font-medium text-green-700 whitespace-nowrap">
                    Entry scan:
                </label>
                <input
                    ref={entryRef}
                    type="text"
                    placeholder="Type card UID + Enter"
                    className="flex-1 px-2 py-1 text-sm border border-green-300 rounded focus:outline-none focus:ring-1 focus:ring-green-400"
                    onKeyDown={handleEntryKey}
                />
            </div>
            <div className="flex-1 flex items-center gap-2">
                <label className="text-sm font-medium text-blue-700 whitespace-nowrap">
                    Exit scan:
                </label>
                <input
                    ref={exitRef}
                    type="text"
                    placeholder="Type card UID + Enter"
                    className="flex-1 px-2 py-1 text-sm border border-blue-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
                    onKeyDown={handleExitKey}
                />
            </div>
        </div>
    );
}
