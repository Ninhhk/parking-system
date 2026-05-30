"use client";

import { useEffect, useRef, useState } from "react";
import { getGatewayLaneConfig, getSubscriptionByCard, checkInByRfid } from "@/app/api/employee.client";
import { detectLicensePlate } from "@/app/api/employee.lpd.client";
import KioskCameraPanel from "./components/KioskCameraPanel";
import ReaderPanel from "./components/ReaderPanel";
import VehicleFormPanel from "./components/VehicleFormPanel";
import ResultPanel from "./components/ResultPanel";
import GateStatusPanel from "./components/GateStatusPanel";

const LANE_ID = process.env.NEXT_PUBLIC_LANE_ID || "lane-card-lpd-1";

const KIOSK_STATES = {
    IDLE: "idle",
    SCANNING: "scanning",
    SUCCESS: "success",
    DENIED: "denied",
    ERROR: "error",
};

const STATUS_MESSAGES = {
    [KIOSK_STATES.IDLE]: "Ready to scan",
    [KIOSK_STATES.SCANNING]: "Scanning card...",
    [KIOSK_STATES.SUCCESS]: "Access granted",
    [KIOSK_STATES.DENIED]: "Access denied",
    [KIOSK_STATES.ERROR]: "System error",
};

function getKioskStatusMessage(state) {
    return STATUS_MESSAGES[state] || "Unknown status";
}

export default function UnifiedCheckinPage() {
    // Lane config state
    const [laneConfig, setLaneConfig] = useState(null);
    const [laneConfigError, setLaneConfigError] = useState(null);
    const [lpdEnabled, setLpdEnabled] = useState(false);

    // Kiosk state machine
    const [kioskState, setKioskState] = useState(KIOSK_STATES.IDLE);

    // Form state
    const [card_uid, setCardUid] = useState("");
    const [vehicle_type, setVehicleType] = useState("");

    // Subscription auto-resolve
    const [subscription, setSubscription] = useState(null);
    const [subscriptionLoading, setSubscriptionLoading] = useState(false);
    const [subscriptionError, setSubscriptionError] = useState(false);
    const [vehicleTypeOverridden, setVehicleTypeOverridden] = useState(false);

    // LPD
    const [detectedPlate, setDetectedPlate] = useState(null);
    const [lpdNotification, setLpdNotification] = useState(null); // { type: "success" | "warning", message }

    // Camera
    const [cameraStatus, setCameraStatus] = useState("connecting");
    const cameraRef = useRef(null);

    // Capture failure state
    const [captureError, setCaptureError] = useState(false);

    // Result
    const [resultDetail, setResultDetail] = useState("");
    const [ticket, setTicket] = useState(null);

    // Clock
    const [currentTime, setCurrentTime] = useState("");

    // Fetch lane config on mount with 5s timeout
    useEffect(() => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        getGatewayLaneConfig(LANE_ID)
            .then((data) => {
                clearTimeout(timeoutId);
                setLaneConfig(data);
                const lpd = Array.isArray(data.allowed_trigger_modules) &&
                    data.allowed_trigger_modules.includes("LPD");
                setLpdEnabled(lpd);
            })
            .catch((err) => {
                clearTimeout(timeoutId);
                const message = err.name === "AbortError"
                    ? "Lane configuration request timed out"
                    : "Failed to load lane configuration";
                setLaneConfigError(message);
                setLpdEnabled(false);
            });

        return () => {
            clearTimeout(timeoutId);
            controller.abort();
        };
    }, []);

    // Clock tick
    useEffect(() => {
        const updateClock = () => {
            const now = new Date();
            setCurrentTime(now.toLocaleTimeString("en-US", { hour12: false }));
        };
        updateClock();
        const timer = setInterval(updateClock, 1000);
        return () => clearInterval(timer);
    }, []);

    const isScanning = kioskState === KIOSK_STATES.SCANNING;

    const handleCardChange = (e) => {
        setCardUid(e.target.value);
    };

    const handleVehicleTypeChange = (e) => {
        setVehicleType(e.target.value);
        if (subscription) {
            setVehicleTypeOverridden(true);
        }
    };

    // Scan flow: Enter key in ReaderPanel triggers subscription lookup
    const handleScan = async () => {
        if (isScanning) return;

        const cardUid = card_uid.trim();
        if (!cardUid) return;

        setKioskState(KIOSK_STATES.SCANNING);
        setSubscription(null);
        setSubscriptionLoading(true);
        setSubscriptionError(false);
        setVehicleTypeOverridden(false);
        setVehicleType("");
        setResultDetail("");
        setTicket(null);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        try {
            const data = await getSubscriptionByCard(cardUid);
            clearTimeout(timeoutId);
            // Subscription found — auto-fill vehicle type
            setSubscription(data);
            setVehicleType(data.vehicle_type || "");
        } catch (err) {
            clearTimeout(timeoutId);
            if (err?.response?.status === 404) {
                // No subscription — leave vehicle type empty for manual selection
                setSubscription(null);
            } else {
                // Network/server error — show error, fall back to manual
                setSubscription(null);
                setSubscriptionError(true);
            }
        } finally {
            setSubscriptionLoading(false);
            setKioskState(KIOSK_STATES.IDLE);
        }
    };

    // Submit flow: capture image, run LPD if enabled, then call checkInByRfid
    const handleSubmit = async () => {
        if (isScanning) return;

        const cardUid = card_uid.trim();
        if (!cardUid) return;
        if (!vehicle_type) return;

        setKioskState(KIOSK_STATES.SCANNING);
        setResultDetail("");
        setTicket(null);
        setCaptureError(false);
        setLpdNotification(null);
        setDetectedPlate(null);

        // Determine vehicle type: operator override takes precedence
        const finalVehicleType = vehicleTypeOverridden ? vehicle_type : (subscription?.vehicle_type || vehicle_type);

        // --- Camera capture ---
        let imageInUrl = null;
        let metadataIn = null;

        if (laneConfig?.has_camera === false) {
            // No camera configured — degraded mode
            metadataIn = { no_camera_evidence: true };
        } else {
            // Attempt capture
            const captured = cameraRef.current?.capture();
            if (!captured) {
                // Capture failed — block submission, show error with retry options
                setCaptureError(true);
                setKioskState(KIOSK_STATES.IDLE);
                return;
            }
            imageInUrl = captured;
        }

        // --- LPD detection (if enabled and image available) ---
        let licensePlate = null;

        if (lpdEnabled && imageInUrl) {
            try {
                // Enforce a 10s deadline (Req 4.6) without blocking on the underlying request.
                const timeout = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error("LPD_TIMEOUT")), 10000)
                );
                const lpdResult = await Promise.race([detectLicensePlate(imageInUrl), timeout]);

                if (lpdResult?.normalized_plate) {
                    licensePlate = lpdResult.normalized_plate;
                    setDetectedPlate(licensePlate);
                    setLpdNotification({ type: "success", message: `Plate detected: ${licensePlate}` });
                }
            } catch (lpdErr) {
                // LPD failed or timed out — proceed without plate
                const msg = lpdErr.message === "LPD_TIMEOUT"
                    ? "Plate detection timed out"
                    : "Plate detection failed";
                setLpdNotification({ type: "warning", message: `${msg}. Proceeding without plate.` });
            }
        }

        // --- Build payload and submit ---
        const payload = {
            card_uid: cardUid,
            vehicle_type: finalVehicleType,
        };

        if (imageInUrl) {
            payload.image_in_url = imageInUrl;
        }
        if (licensePlate) {
            payload.license_plate = licensePlate;
        }
        if (metadataIn) {
            payload.metadata_in = metadataIn;
        }

        try {
            const response = await checkInByRfid(payload);

            setKioskState(KIOSK_STATES.SUCCESS);
            setTicket(response.ticket || null);
            setResultDetail(`Access granted for ${cardUid}`);
        } catch (error) {
            const statusCode = error?.response?.status;
            if (statusCode === 409) {
                setKioskState(KIOSK_STATES.DENIED);
            } else {
                setKioskState(KIOSK_STATES.ERROR);
            }
            const message = error?.response?.data?.message || "Check-in failed";
            setResultDetail(message);
        }
    };

    // Retry camera capture after failure
    const handleRetryCapture = () => {
        setCaptureError(false);
        handleSubmit();
    };

    // Proceed without image after capture failure
    const handleProceedWithoutImage = async () => {
        setCaptureError(false);

        if (isScanning) return;

        const cardUid = card_uid.trim();
        if (!cardUid) return;
        if (!vehicle_type) return;

        setKioskState(KIOSK_STATES.SCANNING);
        setResultDetail("");
        setTicket(null);
        setLpdNotification(null);
        setDetectedPlate(null);

        const finalVehicleType = vehicleTypeOverridden ? vehicle_type : (subscription?.vehicle_type || vehicle_type);

        const payload = {
            card_uid: cardUid,
            vehicle_type: finalVehicleType,
            metadata_in: { no_camera_evidence: true },
        };

        try {
            const response = await checkInByRfid(payload);
            setKioskState(KIOSK_STATES.SUCCESS);
            setTicket(response.ticket || null);
            setResultDetail(`Access granted for ${cardUid}`);
        } catch (error) {
            const statusCode = error?.response?.status;
            if (statusCode === 409) {
                setKioskState(KIOSK_STATES.DENIED);
            } else {
                setKioskState(KIOSK_STATES.ERROR);
            }
            const message = error?.response?.data?.message || "Check-in failed";
            setResultDetail(message);
        }
    };

    return (
        <main className="mx-auto max-w-6xl p-6 bg-white text-slate-800 rounded-2xl border border-gray-200 shadow-sm my-4">
            {/* Header */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-gray-150 pb-4 mb-6 gap-3">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
                        <h1 className="text-xl font-bold uppercase tracking-wider text-slate-900 font-mono">
                            Check-in Kiosk
                        </h1>
                    </div>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">UNIFIED GATEWAY TERMINAL</p>
                </div>

                <div className="flex items-center gap-4 text-xs font-mono">
                    <div className="bg-gray-50 border border-gray-200 px-3 py-1.5 rounded flex items-center gap-2 text-slate-600 shadow-xs">
                        <span className="text-slate-400 uppercase tracking-widest text-[9px]">CLOCK:</span>
                        <span className="font-bold text-indigo-600 tracking-widest">{currentTime || "00:00:00"}</span>
                    </div>
                </div>
            </header>

            {/* Lane config warning banner */}
            {laneConfigError && (
                <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 flex items-center gap-3">
                    <svg className="w-5 h-5 text-amber-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div>
                        <p className="text-sm font-medium text-amber-800">{laneConfigError}</p>
                        <p className="text-xs text-amber-600 mt-0.5">LPD is disabled. Check-in will proceed without plate detection.</p>
                    </div>
                </div>
            )}

            {/* Main grid layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left pane: Camera */}
                <div className="lg:col-span-7 space-y-6 flex flex-col">
                    <KioskCameraPanel ref={cameraRef} />

                    {/* LPD status indicator — only shown when LPD is enabled */}
                    {lpdEnabled && (
                        <div className="rounded-lg border border-indigo-100 bg-indigo-50/50 px-4 py-2.5 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-indigo-500" />
                            <span className="text-xs font-mono font-semibold text-indigo-700 uppercase tracking-wider">
                                LPD Active
                            </span>
                            <span className="text-xs text-indigo-500 ml-1">
                                — Plate detection will run on submission
                            </span>
                        </div>
                    )}

                    {/* Capture failure error — blocks submission until resolved */}
                    {captureError && (
                        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3">
                            <div className="flex items-center gap-2 mb-2">
                                <svg className="w-5 h-5 text-rose-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                <p className="text-sm font-medium text-rose-800">Camera capture failed</p>
                            </div>
                            <p className="text-xs text-rose-600 mb-3">Unable to capture image from camera. The stream may be interrupted or permission revoked.</p>
                            <div className="flex gap-2">
                                <button
                                    onClick={handleRetryCapture}
                                    className="px-3 py-1.5 text-xs font-medium rounded-md bg-rose-600 text-white hover:bg-rose-700 transition-colors"
                                >
                                    Retry
                                </button>
                                <button
                                    onClick={handleProceedWithoutImage}
                                    className="px-3 py-1.5 text-xs font-medium rounded-md border border-rose-300 text-rose-700 hover:bg-rose-100 transition-colors"
                                >
                                    Proceed without image
                                </button>
                            </div>
                        </div>
                    )}

                    {/* No camera configured warning */}
                    {laneConfig && laneConfig.has_camera === false && (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 flex items-center gap-2">
                            <svg className="w-4 h-4 text-amber-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <span className="text-xs text-amber-700 font-medium">No camera configured — check-in will proceed without image evidence</span>
                        </div>
                    )}
                </div>

                {/* Right pane: Controls & Status */}
                <div className="lg:col-span-5 space-y-6">
                    <GateStatusPanel isOpen={kioskState === KIOSK_STATES.SUCCESS} />

                    <ReaderPanel
                        value={card_uid}
                        onChange={handleCardChange}
                        disabled={isScanning}
                        onSubmit={handleScan}
                    />

                    <VehicleFormPanel
                        value={vehicle_type}
                        onChange={handleVehicleTypeChange}
                        disabled={isScanning || !card_uid.trim()}
                        onSubmit={handleSubmit}
                        subscription={subscription}
                        subscriptionLoading={subscriptionLoading}
                        subscriptionError={subscriptionError}
                    />

                    {/* LPD notification */}
                    {lpdNotification && (
                        <div className={`rounded-lg border px-4 py-2.5 flex items-center gap-2 ${
                            lpdNotification.type === "success"
                                ? "border-emerald-200 bg-emerald-50"
                                : "border-amber-200 bg-amber-50"
                        }`}>
                            <span className={`w-2 h-2 rounded-full ${
                                lpdNotification.type === "success" ? "bg-emerald-500" : "bg-amber-500"
                            }`} />
                            <span className={`text-xs font-medium ${
                                lpdNotification.type === "success" ? "text-emerald-700" : "text-amber-700"
                            }`}>
                                {lpdNotification.message}
                            </span>
                        </div>
                    )}

                    <ResultPanel
                        stateLabel={getKioskStatusMessage(kioskState)}
                        detail={resultDetail}
                        sessionId={ticket?.session_id}
                    />
                </div>
            </div>
        </main>
    );
}
