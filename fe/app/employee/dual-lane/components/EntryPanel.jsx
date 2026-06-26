"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
    getGatewayLaneConfig,
    getSubscriptionByCard,
    checkInByRfid,
    checkInVehicle,
    fetchMyLot,
    setGateLight,
} from "@/app/api/employee.client";
import { detectLicensePlate } from "@/app/api/employee.lpd.client";
import { fetchEmployeeGateSettings } from "@/app/api/admin.gateSettings.client";

const PANEL_STATES = {
    IDLE: "idle",
    PROCESSING: "processing",
    SUCCESS: "success",
    DENIED: "denied",
    ERROR: "error",
};

const AUTO_RESET_MS = 5000;

/**
 * Entry panel for the dual-lane kiosk.
 * Wraps check-in logic: subscription lookup → subscriber/casual → gate.
 *
 * @param {{ cardUid: string|null, laneId: string, onReset: () => void }} props
 */
export default function EntryPanel({ cardUid, laneId, onReset }) {
    const [panelState, setPanelState] = useState(PANEL_STATES.IDLE);
    const [resultMessage, setResultMessage] = useState("");
    const [ticket, setTicket] = useState(null);
    const [gateState, setGateState] = useState("shut");

    // Lane config
    const [laneConfig, setLaneConfig] = useState(null);
    const [casualMode, setCasualMode] = useState("issued_card");
    const [autoCloseDuration, setAutoCloseDuration] = useState(4000);

    const processingRef = useRef(false);
    const resetTimerRef = useRef(null);
    const gateTimerRef = useRef(null);

    // Mount: fetch lane config + lot data + gate settings
    useEffect(() => {
        getGatewayLaneConfig(laneId)
            .then((data) => setLaneConfig(data))
            .catch(() => setLaneConfig(null));

        fetchMyLot()
            .then((lot) => setCasualMode(lot?.casual_entry_mode || "issued_card"))
            .catch(() => setCasualMode("issued_card"));

        fetchEmployeeGateSettings()
            .then((data) => {
                if (data?.auto_close_duration_seconds) {
                    setAutoCloseDuration(data.auto_close_duration_seconds * 1000);
                }
            })
            .catch(() => {});

        return () => {
            if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
            if (gateTimerRef.current) clearTimeout(gateTimerRef.current);
        };
    }, [laneId]);

    const openGate = useCallback((plate) => {
        setGateState("open");
        setGateLight(laneId, { status: "OPEN", plate: plate || "", message: "Mời vào" }).catch(() => {});
        if (gateTimerRef.current) clearTimeout(gateTimerRef.current);
        gateTimerRef.current = setTimeout(() => setGateState("shut"), autoCloseDuration);
    }, [laneId, autoCloseDuration]);

    const resetPanel = useCallback(() => {
        setPanelState(PANEL_STATES.IDLE);
        setResultMessage("");
        setTicket(null);
        processingRef.current = false;
        onReset();
    }, [onReset]);

    const scheduleReset = useCallback((ms = AUTO_RESET_MS) => {
        if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
        resetTimerRef.current = setTimeout(resetPanel, ms);
    }, [resetPanel]);

    // Process scan when cardUid changes
    useEffect(() => {
        if (!cardUid || processingRef.current) return;
        processingRef.current = true;
        setPanelState(PANEL_STATES.PROCESSING);
        setResultMessage("Processing...");

        (async () => {
            try {
                // 1. Subscription lookup
                let subscription = null;
                try {
                    subscription = await getSubscriptionByCard(cardUid);
                } catch (err) {
                    // 404 = no subscription — continue to casual path
                    if (err?.response?.status !== 404) throw err;
                }

                const vehicleType = laneConfig?.vehicle_type || "bike";

                if (subscription) {
                    // Subscriber tap-and-go
                    const payload = {
                        card_uid: cardUid,
                        vehicle_type: subscription.vehicle_type || vehicleType,
                        entry_lane_id: laneId,
                    };

                    const result = await checkInByRfid(payload);
                    setPanelState(PANEL_STATES.SUCCESS);
                    setResultMessage(`✓ Subscriber: ${subscription.owner_name || cardUid}`);
                    setTicket(result.ticket);
                    openGate(result.ticket?.license_plate || "");
                    scheduleReset();
                } else if (casualMode === "issued_card") {
                    // Issued-card casual entry
                    const payload = {
                        card_uid: cardUid,
                        vehicle_type: vehicleType,
                        entry_lane_id: laneId,
                        metadata_in: { entry_type: "casual" },
                    };

                    const result = await checkInVehicle(payload);
                    setPanelState(PANEL_STATES.SUCCESS);
                    setResultMessage(`✓ Casual entry: ${cardUid}`);
                    setTicket(result.ticket);
                    openGate(result.ticket?.license_plate || "");
                    scheduleReset();
                } else {
                    // session_ticket mode: non-subscriber card → reject
                    setPanelState(PANEL_STATES.DENIED);
                    setResultMessage("Card not recognized");
                    scheduleReset();
                }
            } catch (err) {
                const msg = err?.response?.data?.message || err.message || "Check-in failed";
                setPanelState(PANEL_STATES.DENIED);
                setResultMessage(msg);
                scheduleReset();
            }
        })();
    }, [cardUid]); // eslint-disable-line react-hooks/exhaustive-deps

    const stateColors = {
        [PANEL_STATES.IDLE]: "bg-slate-50",
        [PANEL_STATES.PROCESSING]: "bg-yellow-50",
        [PANEL_STATES.SUCCESS]: "bg-green-50",
        [PANEL_STATES.DENIED]: "bg-red-50",
        [PANEL_STATES.ERROR]: "bg-red-50",
    };

    return (
        <div className={`h-full flex flex-col p-4 ${stateColors[panelState]}`}>
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-green-700">
                    ← ENTRY
                </h2>
                <div className={`w-4 h-4 rounded-full ${gateState === "open" ? "bg-green-500" : "bg-red-500"}`} />
            </div>

            {/* Lane info */}
            {laneConfig && (
                <div className="text-xs text-gray-500 mb-4">
                    Lane: {laneId} | Vehicle: {laneConfig.vehicle_type || "mixed"} | LPD: {laneConfig.lpd_enabled ? "on" : "off"}
                </div>
            )}

            {/* Status area */}
            <div className="flex-1 flex flex-col items-center justify-center">
                {panelState === PANEL_STATES.IDLE && (
                    <div className="text-center text-gray-400">
                        <div className="text-4xl mb-2">🔲</div>
                        <p className="text-lg">Waiting for card scan...</p>
                        <p className="text-sm">Mode: {casualMode}</p>
                    </div>
                )}

                {panelState === PANEL_STATES.PROCESSING && (
                    <div className="text-center text-yellow-600">
                        <div className="text-4xl mb-2 animate-pulse">⏳</div>
                        <p className="text-lg">{resultMessage}</p>
                    </div>
                )}

                {panelState === PANEL_STATES.SUCCESS && (
                    <div className="text-center text-green-700">
                        <div className="text-4xl mb-2">✅</div>
                        <p className="text-lg font-semibold">{resultMessage}</p>
                        {ticket && (
                            <div className="mt-3 text-sm text-gray-600">
                                <p>Session: {ticket.session_id}</p>
                                {ticket.license_plate && <p>Plate: {ticket.license_plate}</p>}
                                <p>Type: {ticket.vehicle_type}</p>
                            </div>
                        )}
                    </div>
                )}

                {(panelState === PANEL_STATES.DENIED || panelState === PANEL_STATES.ERROR) && (
                    <div className="text-center text-red-700">
                        <div className="text-4xl mb-2">❌</div>
                        <p className="text-lg font-semibold">{resultMessage}</p>
                    </div>
                )}
            </div>

            {/* Gate indicator */}
            <div className={`mt-4 py-2 text-center rounded font-bold text-white ${
                gateState === "open" ? "bg-green-600" : "bg-red-600"
            }`}>
                GATE: {gateState === "open" ? "OPEN" : "CLOSED"}
            </div>
        </div>
    );
}
