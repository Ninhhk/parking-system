"use client";

import { useEffect, useRef, useState } from "react";
import { getGatewayLaneConfig, getSubscriptionByCard, checkInByRfid, checkInVehicle, fetchMyLot } from "@/app/api/employee.client";
import { detectLicensePlate } from "@/app/api/employee.lpd.client";
import KioskCameraPanel from "./components/KioskCameraPanel";
import ReaderPanel from "./components/ReaderPanel";
import CasualEntryControl from "./components/CasualEntryControl";
import VehicleFormPanel from "./components/VehicleFormPanel";
import ResultPanel from "./components/ResultPanel";
import GateStatusPanel from "./components/GateStatusPanel";
import SubscriptionBadge from "./components/SubscriptionBadge";

const LANE_ID = process.env.NEXT_PUBLIC_LANE_ID || "lane-card-lpd-1";

const KIOSK_STATES = {
    IDLE: "idle",
    SCANNING: "scanning",
    SUCCESS: "success",
    DENIED: "denied",
    ERROR: "error",
    CAPTURE_FAILED: "capture_failed",
};

const STATUS_MESSAGES = {
    [KIOSK_STATES.IDLE]: "Ready to scan",
    [KIOSK_STATES.SCANNING]: "Scanning card...",
    [KIOSK_STATES.SUCCESS]: "Access granted",
    [KIOSK_STATES.DENIED]: "Access denied",
    [KIOSK_STATES.ERROR]: "System error",
    [KIOSK_STATES.CAPTURE_FAILED]: "Camera capture failed",
};

function getKioskStatusMessage(state) {
    return STATUS_MESSAGES[state] || "Unknown status";
}

// Thrown by captureAndDetect when the camera is live but a frame cannot be grabbed.
// Distinguishes a genuine capture failure (operator must retry/decide) from a lane
// with no camera configured (degraded mode proceeds automatically).
class CaptureFailedError extends Error {
    constructor() {
        super("Camera capture failed");
        this.name = "CaptureFailedError";
    }
}

export default function UnifiedCheckinPage() {
    // --- State model (from design.md) ---

    // Lane config
    const [laneConfig, setLaneConfig] = useState(null);
    const [laneConfigError, setLaneConfigError] = useState(null);

    // Casual mode from lot read (app-wide default: issued_card)
    const [casualMode, setCasualMode] = useState("issued_card");

    // Kiosk state machine
    const [kioskState, setKioskState] = useState(KIOSK_STATES.IDLE);
    const [entryType, setEntryType] = useState(null); // "subscriber" | "casual_ticket" | "casual_card" | null

    // Card path
    const [card_uid, setCardUid] = useState("");
    const [subscription, setSubscription] = useState(null);

    // Casual
    const [pendingVehiclePick, setPendingVehiclePick] = useState(false);
    const [vehicle_type, setVehicleType] = useState("");

    // LPD / camera
    const [lpdEnabled, setLpdEnabled] = useState(false);
    const [detectedPlate, setDetectedPlate] = useState(null);

    // Gate (simulated)
    const [gateState, setGateState] = useState("shut");

    // Result
    const [resultDetail, setResultDetail] = useState("");
    const [ticket, setTicket] = useState(null);

    // Clock
    const [currentTime, setCurrentTime] = useState("");

    // Refs
    const cameraRef = useRef(null);
    const gateTimerRef = useRef(null);
    // Holds the in-flight submission so a capture-failure Retry/Proceed choice can resume it
    const pendingSubmitRef = useRef(null);

    // --- On mount: fetch lane config with 5s timeout ---
    useEffect(() => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        getGatewayLaneConfig(LANE_ID)
            .then((data) => {
                clearTimeout(timeoutId);
                setLaneConfig(data);
                // LPD status comes from the backend, which now reflects the admin
                // Camera Management config (active plate camera + enabled LPD module),
                // not just the static lane policy. Fall back to the lane policy only
                // if the backend doesn't report the flag (older API).
                const lpd = typeof data.lpd_enabled === "boolean"
                    ? data.lpd_enabled
                    : (Array.isArray(data.allowed_trigger_modules) &&
                        data.allowed_trigger_modules.includes("LPD"));
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

    // --- On mount: fetch lot data for casual_entry_mode ---
    useEffect(() => {
        fetchMyLot()
            .then((lot) => {
                const mode = lot?.casual_entry_mode || "issued_card";
                setCasualMode(mode);
            })
            .catch(() => {
                // Default to issued_card if lot read fails (app-wide default)
                setCasualMode("issued_card");
            });
    }, []);

    // --- Clock tick ---
    useEffect(() => {
        const updateClock = () => {
            const now = new Date();
            setCurrentTime(now.toLocaleTimeString("en-US", { hour12: false }));
        };
        updateClock();
        const timer = setInterval(updateClock, 1000);
        return () => clearInterval(timer);
    }, []);

    // --- Cleanup gate timer on unmount ---
    useEffect(() => {
        return () => {
            if (gateTimerRef.current) clearTimeout(gateTimerRef.current);
        };
    }, []);

    // --- Auto-reset after success/denied ---
    useEffect(() => {
        if (kioskState === KIOSK_STATES.SUCCESS || kioskState === KIOSK_STATES.DENIED) {
            const timer = setTimeout(() => {
                resetKiosk();
            }, 4000);
            return () => clearTimeout(timer);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [kioskState]);

    // --- Spacebar binding for session_ticket casual trigger ---
    useEffect(() => {
        if (casualMode !== "session_ticket") return;

        const handleKeyDown = (e) => {
            if (e.code !== "Space") return;
            const tag = document.activeElement?.tagName?.toLowerCase();
            if (tag === "input" || tag === "textarea") return;
            e.preventDefault();
            handleCasualTrigger();
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [casualMode, kioskState, laneConfig]);

    const resetKiosk = () => {
        setCardUid("");
        setSubscription(null);
        setResultDetail("");
        setTicket(null);
        setEntryType(null);
        setVehicleType("");
        setDetectedPlate(null);
        setPendingVehiclePick(false);
        pendingSubmitRef.current = null;
        setKioskState(KIOSK_STATES.IDLE);
        setGateState("shut");
    };

    // --- Capture + LPD (Req 3.2, 3.3, 3.4, 3.5, 4.3, 4.5, 4.6) ---
    //
    // forceProceed=true skips capture entirely (operator chose "Proceed without image"
    // after a capture failure). Returns { imageUrl, plate, noCameraEvidence }.
    // Throws CaptureFailedError when the camera should be live but the frame grab fails.
    const captureAndDetect = async ({ forceProceed = false } = {}) => {
        // No camera configured for the lane → degraded mode, flag the absence (Req 3.3, 3.4)
        if (laneConfig?.has_camera === false) {
            return { imageUrl: null, plate: null, noCameraEvidence: true };
        }

        // Operator explicitly chose to proceed without an image after a capture failure (Req 3.5)
        if (forceProceed) {
            return { imageUrl: null, plate: null, noCameraEvidence: true };
        }

        // Attempt capture; a null result from a configured camera is a genuine failure
        const imageUrl = cameraRef.current?.capture?.() || null;
        if (!imageUrl) {
            throw new CaptureFailedError();
        }

        // Run LPD if the lane supports it (Req 4.3, 4.5, 4.6)
        if (lpdEnabled) {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);
            try {
                const result = await detectLicensePlate(imageUrl);
                clearTimeout(timeoutId);
                setDetectedPlate(result.normalized_plate);
                return { imageUrl, plate: result.normalized_plate, noCameraEvidence: false };
            } catch (err) {
                clearTimeout(timeoutId);
                console.warn("[Kiosk] LPD failed/timed out:", err.message);
                return { imageUrl, plate: null, noCameraEvidence: false };
            }
        }

        return { imageUrl, plate: null, noCameraEvidence: false };
    };

    // --- Build the metadata_in object, attaching evidence/casual flags as needed ---
    const buildMetadata = ({ casual, noCameraEvidence }) => {
        const meta = {};
        if (casual) meta.entry_type = "casual";
        if (noCameraEvidence) meta.no_camera_evidence = true;
        return Object.keys(meta).length > 0 ? meta : undefined;
    };

    // --- Unified submit dispatcher ---
    //
    // descriptor = { kind: "subscriber" | "casual_ticket" | "casual_card",
    //                cardUid, sub, resolvedType }
    // On capture failure, stashes the descriptor in pendingSubmitRef and surfaces the
    // CAPTURE_FAILED state so the operator can Retry or Proceed without image.
    const runSubmit = async (descriptor, { forceProceed = false } = {}) => {
        let capture;
        try {
            capture = await captureAndDetect({ forceProceed });
        } catch (err) {
            if (err instanceof CaptureFailedError) {
                pendingSubmitRef.current = descriptor;
                setKioskState(KIOSK_STATES.CAPTURE_FAILED);
                setResultDetail("Camera capture failed — retry or proceed without image");
                setGateState("shut");
                return;
            }
            throw err;
        }

        const { imageUrl, plate, noCameraEvidence } = capture;
        const casual = descriptor.kind !== "subscriber";

        try {
            let res;
            if (descriptor.kind === "subscriber") {
                res = await checkInByRfid({
                    card_uid: descriptor.cardUid,
                    vehicle_type: descriptor.sub.vehicle_type,
                    image_in_url: imageUrl,
                    license_plate: plate,
                    entry_lane_id: LANE_ID,
                    metadata_in: buildMetadata({ casual: false, noCameraEvidence }),
                });
                setResultDetail(`Welcome, ${descriptor.sub.owner_name}`);
            } else {
                const payload = {
                    vehicle_type: descriptor.resolvedType,
                    image_in_url: imageUrl,
                    license_plate: plate,
                    entry_lane_id: LANE_ID,
                    metadata_in: buildMetadata({ casual: true, noCameraEvidence }),
                };
                if (descriptor.kind === "casual_card") {
                    payload.card_uid = descriptor.cardUid;
                }
                res = await checkInVehicle(payload);
                setResultDetail(
                    descriptor.kind === "casual_card"
                        ? "Issued-card entry — gate open"
                        : "Casual entry — session created"
                );
            }

            pendingSubmitRef.current = null;
            setKioskState(KIOSK_STATES.SUCCESS);
            setTicket(res.ticket || null);
            setGateState("open");
        } catch (err) {
            pendingSubmitRef.current = null;
            const status = err.response?.status || err?.status;
            if (status === 409 || status === 422) {
                setKioskState(KIOSK_STATES.DENIED);
                setResultDetail(err.response?.data?.message || "Entry denied");
                setGateState("shut");
            } else {
                setKioskState(KIOSK_STATES.ERROR);
                setResultDetail("Check-in failed");
                setGateState("shut");
            }
        }
    };

    // --- Capture-failure resolution (Req 3.5) ---
    const handleRetryCapture = () => {
        const descriptor = pendingSubmitRef.current;
        if (!descriptor) return;
        setKioskState(KIOSK_STATES.SCANNING);
        setResultDetail("");
        runSubmit(descriptor);
    };

    const handleProceedWithoutImage = () => {
        const descriptor = pendingSubmitRef.current;
        if (!descriptor) return;
        setKioskState(KIOSK_STATES.SCANNING);
        setResultDetail("");
        runSubmit(descriptor, { forceProceed: true });
    };

    // --- Core handlers ---

    const handleCardTap = async (cardUid) => {
        // Concurrent-tap guard
        if (kioskState === KIOSK_STATES.SCANNING) return;

        // Set scanning, clear previous state
        setKioskState(KIOSK_STATES.SCANNING);
        setSubscription(null);
        setResultDetail("");
        setTicket(null);
        setDetectedPlate(null);
        setEntryType(null);
        pendingSubmitRef.current = null;

        // Subscription lookup with 5s timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        try {
            const sub = await getSubscriptionByCard(cardUid);
            clearTimeout(timeoutId);

            // Active subscription found → subscriber path
            setEntryType("subscriber");
            setSubscription(sub);
            setVehicleType(sub.vehicle_type);
            await runSubmit({ kind: "subscriber", cardUid, sub });
        } catch (error) {
            clearTimeout(timeoutId);

            if (error.response?.status === 404 || error?.status === 404) {
                // No active subscription
                if (casualMode === "issued_card") {
                    setEntryType("casual_card");
                    // Resolve vehicle type: lane-fixed, else operator must pick
                    const resolvedType = laneConfig?.vehicle_type || null;
                    if (!resolvedType) {
                        setPendingVehiclePick(true);
                        setKioskState(KIOSK_STATES.IDLE);
                        return;
                    }
                    await runSubmit({ kind: "casual_card", cardUid, resolvedType });
                } else {
                    // session_ticket mode — card not recognized
                    setKioskState(KIOSK_STATES.DENIED);
                    setResultDetail("Card not recognized");
                    setGateState("shut");
                }
            } else {
                // System error (network/5xx/abort)
                setKioskState(KIOSK_STATES.ERROR);
                setResultDetail("System error — please try again");
                setGateState("shut");
            }
        }
    };

    const handleCasualTrigger = () => {
        if (kioskState === KIOSK_STATES.SCANNING) return;

        setEntryType("casual_ticket");
        setCardUid("");

        if (laneConfig?.vehicle_type) {
            // Fixed lane — use lane vehicle_type, proceed to session-ticket submit
            setKioskState(KIOSK_STATES.SCANNING);
            setVehicleType(laneConfig.vehicle_type);
            runSubmit({ kind: "casual_ticket", resolvedType: laneConfig.vehicle_type });
        } else {
            // Mixed lane — wait for operator pick
            setPendingVehiclePick(true);
        }
    };

    const handleVehicleSelect = (type) => {
        setVehicleType(type);
        setPendingVehiclePick(false);
        setKioskState(KIOSK_STATES.SCANNING);

        if (entryType === "casual_ticket") {
            runSubmit({ kind: "casual_ticket", resolvedType: type });
        } else if (entryType === "casual_card") {
            runSubmit({ kind: "casual_card", cardUid: card_uid, resolvedType: type });
        }
    };

    const handleManualGateOpen = () => {
        setGateState("open");
        if (gateTimerRef.current) clearTimeout(gateTimerRef.current);
        gateTimerRef.current = setTimeout(() => {
            setGateState("shut");
        }, 5000);
    };

    const isScanning = kioskState === KIOSK_STATES.SCANNING;
    const isCaptureFailed = kioskState === KIOSK_STATES.CAPTURE_FAILED;

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

                    {/* No camera configured warning (degraded mode) */}
                    {laneConfig && laneConfig.has_camera === false && (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 flex items-center gap-2">
                            <svg className="w-4 h-4 text-amber-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <span className="text-xs text-amber-700 font-medium">No camera configured — check-in will proceed without image evidence</span>
                        </div>
                    )}

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
                </div>

                {/* Right pane: Controls & Status */}
                <div className="lg:col-span-5 space-y-6">
                    <GateStatusPanel
                        isOpen={gateState === "open"}
                        onManualOpen={handleManualGateOpen}
                    />

                    <ReaderPanel
                        value={card_uid}
                        onChange={(e) => setCardUid(e.target.value)}
                        disabled={isScanning || isCaptureFailed}
                        onSubmit={() => handleCardTap(card_uid.trim())}
                    />

                    {/* CasualEntryControl — only rendered in session_ticket mode */}
                    {casualMode === "session_ticket" && (
                        <CasualEntryControl
                            onTrigger={handleCasualTrigger}
                            disabled={isScanning || isCaptureFailed}
                        />
                    )}

                    {/* VehicleFormPanel — only rendered when pendingVehiclePick (mixed lane casual) */}
                    {pendingVehiclePick && (
                        <VehicleFormPanel
                            onSelect={handleVehicleSelect}
                            disabled={isScanning}
                        />
                    )}

                    {/* Capture-failure resolution (Req 3.5) */}
                    {isCaptureFailed && (
                        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 shadow-sm">
                            <div className="flex items-center gap-2 mb-3">
                                <svg className="w-5 h-5 text-rose-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                <p className="text-sm font-semibold text-rose-800">Camera capture failed</p>
                            </div>
                            <p className="text-xs text-rose-600 mb-3">
                                Could not capture an evidence image. Retry the capture, or proceed without an image (the absence will be logged).
                            </p>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={handleRetryCapture}
                                    className="flex-1 cursor-pointer rounded-lg py-2.5 px-4 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] transition-all shadow-sm"
                                >
                                    Retry
                                </button>
                                <button
                                    type="button"
                                    onClick={handleProceedWithoutImage}
                                    className="flex-1 cursor-pointer rounded-lg py-2.5 px-4 text-sm font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 hover:border-gray-400 active:scale-[0.98] transition-all shadow-sm"
                                >
                                    Proceed without image
                                </button>
                            </div>
                        </div>
                    )}

                    {/* SubscriptionBadge — shows when subscription is resolved */}
                    <SubscriptionBadge subscription={subscription} />

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
