"use client";

import { useState, useEffect } from "react";
import { useScanRouter } from "./hooks/useScanRouter";
import EntryPanel from "./components/EntryPanel";
import ExitPanel from "./components/ExitPanel";
import SimulationInputs from "./components/SimulationInputs";
import ScanIndicator from "./components/ScanIndicator";

const ENTRY_PREFIX = process.env.NEXT_PUBLIC_ENTRY_PREFIX || "I:";
const EXIT_PREFIX = process.env.NEXT_PUBLIC_EXIT_PREFIX || "O:";
const ENTRY_LANE_ID = process.env.NEXT_PUBLIC_ENTRY_LANE_ID || "lane-card-lpd-1";
const EXIT_LANE_ID = process.env.NEXT_PUBLIC_EXIT_LANE_ID || "lane-exit-1";
const ENV_SIMULATION = process.env.NEXT_PUBLIC_DUAL_LANE_SIMULATION === "true";

export default function DualLaneKioskPage() {
    const [viewportOk, setViewportOk] = useState(true);
    const [entryHighlight, setEntryHighlight] = useState(false);
    const [exitHighlight, setExitHighlight] = useState(false);

    // Simulation mode — can be toggled at runtime via button
    const [simulationMode, setSimulationMode] = useState(ENV_SIMULATION || true);

    // Simulation mode dispatches
    const [simEntryScan, setSimEntryScan] = useState(null);
    const [simExitScan, setSimExitScan] = useState(null);

    // Scan router (disabled in simulation mode)
    const { lastEntryScan, lastExitScan, resetEntry, resetExit, configError } = useScanRouter({
        entryPrefix: ENTRY_PREFIX,
        exitPrefix: EXIT_PREFIX,
        enabled: !simulationMode,
    });

    // Merge scan sources: real reader OR simulation
    const activeEntryScan = simulationMode ? simEntryScan : lastEntryScan;
    const activeExitScan = simulationMode ? simExitScan : lastExitScan;

    // Viewport check
    useEffect(() => {
        const check = () => setViewportOk(window.innerWidth >= 1024);
        check();
        window.addEventListener("resize", check);
        return () => window.removeEventListener("resize", check);
    }, []);

    // Highlight entry panel on scan
    useEffect(() => {
        if (activeEntryScan) {
            setEntryHighlight(true);
            const t = setTimeout(() => setEntryHighlight(false), 800);
            return () => clearTimeout(t);
        }
    }, [activeEntryScan]);

    // Highlight exit panel on scan
    useEffect(() => {
        if (activeExitScan) {
            setExitHighlight(true);
            const t = setTimeout(() => setExitHighlight(false), 800);
            return () => clearTimeout(t);
        }
    }, [activeExitScan]);

    // Reset handlers
    const handleEntryReset = () => {
        if (simulationMode) {
            setSimEntryScan(null);
        } else {
            resetEntry();
        }
    };

    const handleExitReset = () => {
        if (simulationMode) {
            setSimExitScan(null);
        } else {
            resetExit();
        }
    };

    // Config error state
    if (configError) {
        return (
            <div className="flex items-center justify-center min-h-[80vh]">
                <div className="bg-red-50 border border-red-300 rounded-lg p-8 max-w-md text-center">
                    <h2 className="text-red-700 text-xl font-semibold mb-2">Configuration Error</h2>
                    <p className="text-red-600">{configError}</p>
                    <p className="text-sm text-gray-500 mt-4">
                        Check NEXT_PUBLIC_ENTRY_PREFIX and NEXT_PUBLIC_EXIT_PREFIX environment variables.
                    </p>
                </div>
            </div>
        );
    }

    // Viewport too narrow
    if (!viewportOk) {
        return (
            <div className="flex items-center justify-center min-h-[80vh]">
                <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-8 max-w-md text-center">
                    <h2 className="text-yellow-700 text-xl font-semibold mb-2">Screen Too Narrow</h2>
                    <p className="text-yellow-600">
                        Dual-lane mode requires a screen width of at least 1024px.
                        Please use a wider monitor or switch to single-lane mode.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-[calc(100vh-80px)] w-full">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2 bg-slate-800 text-white">
                <h1 className="text-lg font-semibold">Dual-Lane Kiosk</h1>
                <div className="flex items-center gap-4 text-sm">
                    <span className="text-green-300">● Entry: {ENTRY_PREFIX}*</span>
                    <span className="text-blue-300">● Exit: {EXIT_PREFIX}*</span>
                    {simulationMode && (
                        <span className="bg-yellow-500 text-black px-2 py-0.5 rounded text-xs font-medium">
                            SIMULATION
                        </span>
                    )}
                    <button
                        onClick={() => setSimulationMode((v) => !v)}
                        className="px-2 py-0.5 rounded text-xs font-medium bg-slate-600 hover:bg-slate-500 transition-colors"
                    >
                        {simulationMode ? "Switch to Reader" : "Switch to Sim"}
                    </button>
                </div>
            </div>

            {/* Simulation inputs (only in sim mode) */}
            {simulationMode && (
                <SimulationInputs
                    onEntryScan={setSimEntryScan}
                    onExitScan={setSimExitScan}
                />
            )}

            {/* Split panels */}
            <div className="flex flex-1 min-h-0">
                {/* Entry Panel (left) */}
                <div className="flex-1 border-r border-slate-300 overflow-auto">
                    <ScanIndicator active={entryHighlight} color="green">
                        <EntryPanel
                            cardUid={activeEntryScan}
                            laneId={ENTRY_LANE_ID}
                            onReset={handleEntryReset}
                        />
                    </ScanIndicator>
                </div>

                {/* Exit Panel (right) */}
                <div className="flex-1 overflow-auto">
                    <ScanIndicator active={exitHighlight} color="blue">
                        <ExitPanel
                            cardUid={activeExitScan}
                            laneId={EXIT_LANE_ID}
                            onReset={handleExitReset}
                        />
                    </ScanIndicator>
                </div>
            </div>
        </div>
    );
}
