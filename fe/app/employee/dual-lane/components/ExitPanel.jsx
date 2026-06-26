"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
    findActiveSessionByCard,
    initiateCheckout,
    confirmCheckout,
    confirmMonthlyCheckout,
    setGateLight,
} from "@/app/api/employee.client";
import { fetchEmployeeGateSettings } from "@/app/api/admin.gateSettings.client";

const PANEL_STATES = {
    IDLE: "idle",
    LOADING: "loading",
    CHECKOUT: "checkout",
    PAYING: "paying",
    SUCCESS: "success",
    ERROR: "error",
};

const AUTO_RESET_MS = 5000;

/**
 * Exit panel for the dual-lane kiosk.
 * Wraps checkout logic: card → session lookup → fee display → payment → gate.
 *
 * @param {{ cardUid: string|null, laneId: string, onReset: () => void }} props
 */
export default function ExitPanel({ cardUid, laneId, onReset }) {
    const [panelState, setPanelState] = useState(PANEL_STATES.IDLE);
    const [resultMessage, setResultMessage] = useState("");
    const [session, setSession] = useState(null);
    const [feeInfo, setFeeInfo] = useState(null);
    const [gateState, setGateState] = useState("shut");
    const [autoCloseDuration, setAutoCloseDuration] = useState(4000);

    const processingRef = useRef(false);
    const resetTimerRef = useRef(null);
    const gateTimerRef = useRef(null);

    // Mount: fetch gate settings
    useEffect(() => {
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
    }, []);

    const openGate = useCallback((plate) => {
        setGateState("open");
        setGateLight(laneId, { status: "OPEN", plate: plate || "", message: "Tạm biệt" }).catch(() => {});
        if (gateTimerRef.current) clearTimeout(gateTimerRef.current);
        gateTimerRef.current = setTimeout(() => setGateState("shut"), autoCloseDuration);
    }, [laneId, autoCloseDuration]);

    const resetPanel = useCallback(() => {
        setPanelState(PANEL_STATES.IDLE);
        setResultMessage("");
        setSession(null);
        setFeeInfo(null);
        processingRef.current = false;
        onReset();
    }, [onReset]);

    const scheduleReset = useCallback((ms = AUTO_RESET_MS) => {
        if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
        resetTimerRef.current = setTimeout(resetPanel, ms);
    }, [resetPanel]);

    // Process scan when cardUid changes
    useEffect(() => {
        if (!cardUid) return;

        // Busy guard: don't interrupt active checkout
        if (panelState === PANEL_STATES.CHECKOUT || panelState === PANEL_STATES.PAYING) {
            // Could show a toast, but for simplicity just ignore
            return;
        }

        processingRef.current = true;
        setPanelState(PANEL_STATES.LOADING);
        setResultMessage("Looking up session...");
        setSession(null);
        setFeeInfo(null);

        (async () => {
            try {
                // 1. Find active session by card
                const sessionData = await findActiveSessionByCard(cardUid);
                if (!sessionData?.session_id) {
                    setPanelState(PANEL_STATES.ERROR);
                    setResultMessage("No active session for this card");
                    scheduleReset();
                    return;
                }

                // 2. Get checkout details (fee, session info)
                const checkoutRes = await initiateCheckout(sessionData.session_id);
                const checkoutData = checkoutRes.data;

                setSession(checkoutData.session_details);
                setFeeInfo({
                    amount: checkoutData.amount,
                    hours: checkoutData.hours,
                    serviceFee: checkoutData.serviceFee,
                    penaltyFee: checkoutData.penaltyFee,
                });
                setPanelState(PANEL_STATES.CHECKOUT);
                setResultMessage("");
                processingRef.current = false;
            } catch (err) {
                const msg = err?.response?.data?.message || err.message || "Checkout lookup failed";
                setPanelState(PANEL_STATES.ERROR);
                setResultMessage(msg);
                scheduleReset();
            }
        })();
    }, [cardUid]); // eslint-disable-line react-hooks/exhaustive-deps

    // CASH payment handler
    const handleCashConfirm = async () => {
        if (!session) return;
        setPanelState(PANEL_STATES.PAYING);
        setResultMessage("Processing payment...");

        try {
            // Monthly sessions (amount = 0) use the one-tap monthly checkout
            if (session.is_monthly && feeInfo?.amount === 0) {
                await confirmMonthlyCheckout(session.session_id);
            } else {
                await confirmCheckout(session.session_id, "CASH");
            }

            setPanelState(PANEL_STATES.SUCCESS);
            setResultMessage("✓ Checkout complete");
            openGate(session.license_plate || "");
            scheduleReset(6000);
        } catch (err) {
            const msg = err?.response?.data?.message || err.message || "Payment failed";
            setPanelState(PANEL_STATES.ERROR);
            setResultMessage(msg);
            scheduleReset();
        }
    };

    // Cancel / go back to idle
    const handleCancel = () => {
        resetPanel();
    };

    const stateColors = {
        [PANEL_STATES.IDLE]: "bg-slate-50",
        [PANEL_STATES.LOADING]: "bg-yellow-50",
        [PANEL_STATES.CHECKOUT]: "bg-blue-50",
        [PANEL_STATES.PAYING]: "bg-yellow-50",
        [PANEL_STATES.SUCCESS]: "bg-green-50",
        [PANEL_STATES.ERROR]: "bg-red-50",
    };

    const formatCurrency = (amount) => {
        if (amount == null) return "—";
        return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount);
    };

    const formatDuration = (hours) => {
        if (hours == null) return "—";
        const h = Math.floor(hours);
        const m = Math.round((hours - h) * 60);
        return h > 0 ? `${h}h ${m}m` : `${m}m`;
    };

    return (
        <div className={`h-full flex flex-col p-4 ${stateColors[panelState]}`}>
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-blue-700">
                    EXIT →
                </h2>
                <div className={`w-4 h-4 rounded-full ${gateState === "open" ? "bg-green-500" : "bg-red-500"}`} />
            </div>

            {/* Status area */}
            <div className="flex-1 flex flex-col items-center justify-center">
                {panelState === PANEL_STATES.IDLE && (
                    <div className="text-center text-gray-400">
                        <div className="text-4xl mb-2">🔲</div>
                        <p className="text-lg">Waiting for card scan...</p>
                    </div>
                )}

                {panelState === PANEL_STATES.LOADING && (
                    <div className="text-center text-yellow-600">
                        <div className="text-4xl mb-2 animate-pulse">⏳</div>
                        <p className="text-lg">{resultMessage}</p>
                    </div>
                )}

                {panelState === PANEL_STATES.CHECKOUT && session && feeInfo && (
                    <div className="w-full max-w-sm">
                        {/* Session info */}
                        <div className="bg-white rounded-lg shadow p-4 mb-4">
                            <h3 className="font-semibold text-gray-800 mb-2">Session Details</h3>
                            <div className="text-sm space-y-1 text-gray-600">
                                {session.license_plate && (
                                    <p>Plate: <span className="font-mono font-bold">{session.license_plate}</span></p>
                                )}
                                <p>Vehicle: {session.vehicle_type}</p>
                                <p>Duration: {formatDuration(feeInfo.hours)}</p>
                                {session.is_monthly && (
                                    <p className="text-green-600 font-medium">Monthly subscription</p>
                                )}
                            </div>
                        </div>

                        {/* Fee */}
                        <div className="bg-white rounded-lg shadow p-4 mb-4">
                            <div className="flex justify-between items-center">
                                <span className="text-gray-600">Total:</span>
                                <span className="text-2xl font-bold text-blue-700">
                                    {formatCurrency(feeInfo.amount)}
                                </span>
                            </div>
                            {feeInfo.penaltyFee > 0 && (
                                <p className="text-xs text-red-500 mt-1">
                                    Includes penalty: {formatCurrency(feeInfo.penaltyFee)}
                                </p>
                            )}
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2">
                            <button
                                onClick={handleCashConfirm}
                                className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg transition-colors"
                            >
                                {session.is_monthly && feeInfo.amount === 0
                                    ? "✓ Confirm Exit"
                                    : "💵 Cash Payment"
                                }
                            </button>
                            <button
                                onClick={handleCancel}
                                className="px-4 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}

                {panelState === PANEL_STATES.PAYING && (
                    <div className="text-center text-yellow-600">
                        <div className="text-4xl mb-2 animate-pulse">💳</div>
                        <p className="text-lg">{resultMessage}</p>
                    </div>
                )}

                {panelState === PANEL_STATES.SUCCESS && (
                    <div className="text-center text-green-700">
                        <div className="text-4xl mb-2">✅</div>
                        <p className="text-lg font-semibold">{resultMessage}</p>
                    </div>
                )}

                {panelState === PANEL_STATES.ERROR && (
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
