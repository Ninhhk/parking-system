"use client";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
    initiateCheckout,
    confirmCheckout,
    confirmMonthlyCheckout,
    reportLostTicket,
    deleteLostTicket,
    createPaymentIntent,
    regeneratePaymentIntent,
    fetchPaymentStatus,
    uploadExitImage,
    findActiveSessionByCard,
    setGateLight,
} from "@/app/api/employee.client";
import { useToast } from "@/app/components/providers/ToastProvider";
import {
    FaRegCreditCard,
    FaMoneyBillWave,
    FaCreditCard,
    FaCheckCircle,
    FaSync,
    FaIdCard,
    FaExclamationTriangle,
    FaImage,
    FaQrcode,
    FaCarSide,
} from "react-icons/fa";
import SessionImage from "@/app/components/common/SessionImage";
import KioskCameraPanel from "@/app/employee/checkin/components/KioskCameraPanel";
import GateStatusPanel from "@/app/employee/checkin/components/GateStatusPanel";
import ReaderPanel from "@/app/employee/checkin/components/ReaderPanel";
import { detectLicensePlate } from "@/app/api/employee.lpd.client";
import { fetchEmployeeGateSettings } from "@/app/api/admin.gateSettings.client";
import { fetchEmployeeCheckoutSettings } from "@/app/api/admin.checkoutSettings.client";
import { CFD_MSG, CFD_CHANNEL, useBroadcastChannel } from "@/app/employee/checkout/cfdChannel";

const CARD_STATUS_LABELS = {
    PENDING: "Pending payment",
    PAID: "Paid",
    FAILED: "Payment failed",
    EXPIRED: "Payment expired",
    NOT_FOUND: "No active payment intent",
    REQUIRES_PAYMENT_METHOD: "Requires payment method",
};

const LANE_ID = process.env.NEXT_PUBLIC_LANE_ID || "lane-card-lpd-1";
const CASH_CONFIRM_TIMEOUT_MS = 10000;

const makeIdempotencyKey = (prefix, sessionId) => `${prefix}-${sessionId}-${Date.now()}`;

const isFutureDate = (value) => {
    if (!value) return false;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return false;
    return date.getTime() > Date.now();
};

const amountsMatch = (left, right) => {
    if (!Number.isFinite(Number(left)) || !Number.isFinite(Number(right))) {
        return true;
    }
    return Math.round(Number(left)) === Math.round(Number(right));
};

const isReusableAttempt = ({ attempt, intentAmount, expectedAmount }) => {
    if (!attempt) return false;
    if (attempt.status !== "PENDING") return false;
    if (!attempt.provider_order_code || !attempt.checkout_url) return false;
    if (!isFutureDate(attempt.expires_at)) return false;
    return amountsMatch(intentAmount, expectedAmount);
};

function CheckoutTerminalContent() {
    const toast = useToast();
    const searchParams = useSearchParams();
    // Single-screen terminal: the resolved session id lives in state (no route param).
    // null → idle "waiting for card"; a value → loaded checkout for that session.
    const initialSessionId = searchParams.get("session_id") || null;
    const [sessionid, setSessionid] = useState(initialSessionId);

    // When session_id comes from the URL (Vehicles → Process), skip monthly auto-finalize
    // so the operator gets a chance to review before confirming.
    const manualProcessRef = useRef(!!initialSessionId);

    // State: loading, error, checkout, payment method
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    // Bumped to re-trigger the checkout load effect for an in-place refresh
    // (e.g. after a lost-ticket report changes the fee) without a full page reload.
    const [reloadNonce, setReloadNonce] = useState(0);
    const [checkout, setCheckout] = useState({
        amount: null,
        hours: null,
        serviceFee: null,
        penaltyFee: null,
        session: null,
    });
    const [paymentMethod, setPaymentMethod] = useState("CARD");
    const [liveHours, setLiveHours] = useState(null);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [showLostTicketForm, setShowLostTicketForm] = useState(false);
    const [guestIdImage, setGuestIdImage] = useState(null);
    const [guestPhone, setGuestPhone] = useState("");
    const [isLostTicket, setIsLostTicket] = useState(false);
    const [reportingLost, setReportingLost] = useState(false);
    const [paymentIntent, setPaymentIntent] = useState(null);
    const [cardStatus, setCardStatus] = useState("PENDING");
    const [creatingIntent, setCreatingIntent] = useState(false);
    const [embedVersion, setEmbedVersion] = useState(0);
    const [regenerateCooldown, setRegenerateCooldown] = useState(0);
    const isMountedRef = useRef(true);
    const checkoutCameraRef = useRef(null);
    // Holds the latest F2-cash-hotkey logic so a once-bound key listener never goes stale.
    const cashHotkeyRef = useRef(null);

    // Gate state machine (matches kiosk check-in pattern)
    const [gateState, setGateState] = useState("shut");
    const gateTimerRef = useRef(null);
    const gateContextRef = useRef(null); // "checkout" | "manual" | "hold" | null
    const holdKeepAliveRef = useRef(null);

    // Configurable auto-close duration (fetched from server, fallback 4000ms)
    const [autoCloseDurationMs, setAutoCloseDurationMs] = useState(4000);

    // Grace delay before the scan field clears + refocuses (admin-configurable, fallback 2000ms)
    const [inputResetMs, setInputResetMs] = useState(2000);

    // View state machine for checkout flow
    const [viewState, setViewState] = useState("input"); // "input" | "processing" | "success" | "payment_failed"
    const [successDetail, setSuccessDetail] = useState(null);

    // Exit-image plate detection for đối chiếu (visual + plate match against check-in)
    const [exitPlate, setExitPlate] = useState(null);
    const [detectingExitPlate, setDetectingExitPlate] = useState(false);

    // Held exit frame, captured once the camera goes live (vehicle-arrival model,
    // mirroring presence-triggered ALPR). The operator can recapture by re-scanning
    // the card. This single frame is sent for both cash and QR/card checkout.
    const [exitImage, setExitImage] = useState(null);
    // Mirror of exitImage for reads inside long-lived closures (e.g. the card-payment
    // polling interval), which would otherwise capture a stale frame.
    const exitImageRef = useRef(null);

    // Card-scan field on the terminal. Dual-purpose:
    //  - same card as the current session  → recapture the exit frame
    //  - a different card                  → resolve that card's session and switch to it
    const [scanUid, setScanUid] = useState("");
    const [switchingSession, setSwitchingSession] = useState(false);
    // Bumped on terminal reset so the idle ReaderPanel remounts and auto-focuses.
    const [resetKey, setResetKey] = useState(0);

    // Grab the current live frame and hold it as the pending exit image.
    // Returns the captured base64 (or null) so callers can chain on it.
    const captureExitImage = () => {
        const frame = checkoutCameraRef.current?.capture();
        if (frame) setExitImage(frame);
        return frame || null;
    };

    // Keep exitImageRef in sync so long-lived closures (card-payment polling) always
    // read the latest captured frame instead of a stale one bound at interval creation.
    useEffect(() => {
        exitImageRef.current = exitImage;
    }, [exitImage]);

    // Operator scanned a card on the terminal (UID + Enter).
    const handleScanCapture = async () => {
        const uid = scanUid.trim();
        if (!uid) return;

        const currentCard = checkout.session?.card_uid;
        const sameCard = currentCard && uid.toUpperCase() === String(currentCard).toUpperCase();

        // Same card → recapture the exit frame for this session
        if (sameCard) {
            const frame = captureExitImage();
            if (frame) {
                toast.success("Exit image captured");
            } else {
                toast.error("Camera not ready — could not capture exit image");
            }
            setScanUid("");
            return;
        }

        // Different card → resolve its active session and switch the terminal to it
        setSwitchingSession(true);
        try {
            const { session_id } = await findActiveSessionByCard(uid);
            if (String(session_id) === String(sessionid)) {
                // Edge case: different UID string that maps to the same session — just recapture
                const frame = captureExitImage();
                if (frame) toast.success("Exit image captured");
            } else {
                // Switch the terminal to the resolved session in place (no navigation).
                // A card scan is a kiosk-lane action, so clear the manual-process flag
                // to restore normal monthly auto-finalize for the new session.
                manualProcessRef.current = false;
                setSessionid(String(session_id));
            }
        } catch (error) {
            const status = error.response?.status;
            const message =
                status === 404
                    ? "No active session found for this card"
                    : error.response?.data?.message || "Failed to look up session";
            toast.error(message);
        } finally {
            setSwitchingSession(false);
            // Keep the failed UID visible briefly, then clear + refocus for the next scan.
            setTimeout(() => setScanUid(""), inputResetMs);
        }
    };

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    // Fetch gate auto-close setting on mount (Req 3.1, 3.3, 3.4)
    useEffect(() => {
        fetchEmployeeGateSettings()
            .then((data) => {
                if (data?.auto_close_duration_seconds) {
                    setAutoCloseDurationMs(data.auto_close_duration_seconds * 1000);
                }
                if (typeof data?.kiosk_input_reset_seconds === "number") {
                    setInputResetMs(data.kiosk_input_reset_seconds * 1000);
                }
            })
            .catch((err) => {
                console.warn("Failed to fetch gate settings, using default 4000ms", err);
            });
    }, []);

    // Seed the admin-configured default payment method on mount.
    // Pre-selection only — the operator can still switch per transaction.
    useEffect(() => {
        fetchEmployeeCheckoutSettings()
            .then((data) => {
                if (data?.default_payment_method) {
                    setPaymentMethod(data.default_payment_method);
                }
            })
            .catch((err) => {
                console.warn("Failed to fetch checkout settings, using default CARD", err);
            });
    }, []);

    // Cleanup gate timer on unmount (matches kiosk pattern)
    useEffect(() => {
        return () => {
            if (gateTimerRef.current) clearTimeout(gateTimerRef.current);
            if (holdKeepAliveRef.current) clearInterval(holdKeepAliveRef.current);
        };
    }, []);

    // Clear all per-session state back to the idle "waiting for card" view WITHOUT
    // touching the gate/timer/context — so a sticky "hold" gate stays open while the
    // terminal readies itself for the next vehicle.
    function clearSessionState() {
        setSessionid(null);
        setCheckout({ amount: null, hours: null, serviceFee: null, penaltyFee: null, session: null });
        setLiveHours(null);
        setPaymentIntent(null);
        setCardStatus("PENDING");
        setCreatingIntent(false);
        setViewState("input");
        setSuccessDetail(null);
        setExitImage(null);
        setExitPlate(null);
        setScanUid("");
        setShowLostTicketForm(false);
        setIsLostTicket(false);
        setError(null);
        setLoading(true);
        monthlyFinalizeRef.current = false;
        manualProcessRef.current = false;
        setResetKey((k) => k + 1);
    }

    // Reset the terminal to idle AND close the gate — no navigation, mirroring the
    // kiosk check-in resetKiosk pattern. Ready for the next vehicle.
    function resetTerminal() {
        if (gateTimerRef.current) clearTimeout(gateTimerRef.current);
        gateTimerRef.current = null;
        gateContextRef.current = null;
        setGateState("shut");
        clearSessionState();
    }

    // Gate control functions (Requirements 3.2, 3.4, 3.10)
    function openGate(context, detail) {
        // Hold = sticky open. While held, the gate stays open and overrides every
        // close trigger (payment success/fail, auto-close): no timer, no overlay,
        // hold context preserved. Only Manual Close exits hold (Req 4.3).
        if (gateContextRef.current === "hold") {
            setGateState("open");
            if (context === "checkout") {
                // Payment finalized server-side — ready the terminal for the next
                // vehicle without closing the propped-open gate.
                clearSessionState();
            }
            return;
        }
        setGateState("open");
        gateContextRef.current = context;
        if (detail) {
            setViewState("success");
            setSuccessDetail(detail);
        }
        if (gateTimerRef.current) clearTimeout(gateTimerRef.current);
        gateTimerRef.current = setTimeout(closeGate, autoCloseDurationMs);
        setGateLight(LANE_ID, { status: "OPEN", plate: checkout.session?.license_plate || "", message: "Tạm biệt" }).catch(() => {});
    }

    function closeGate() {
        if (gateTimerRef.current) clearTimeout(gateTimerRef.current);
        gateTimerRef.current = null;
        if (holdKeepAliveRef.current) { clearInterval(holdKeepAliveRef.current); holdKeepAliveRef.current = null; }
        setGateLight(LANE_ID, { status: "CLOSED" }).catch(() => {});

        if (gateContextRef.current === "checkout") {
            // Successful checkout finished — return to the idle terminal (no navigation)
            resetTerminal();
            return;
        }
        // Manual/hold context: stay on the current session, just close the gate
        setGateState("shut");
        setViewState("input");
        gateContextRef.current = null;
    }

    // Hold-mode open: no timer started (Req 4.1, 4.2, 4.3, 4.6)
    function handleHoldOpen() {
        if (gateTimerRef.current) clearTimeout(gateTimerRef.current);
        gateTimerRef.current = null;
        setGateState("open");
        gateContextRef.current = "hold";
        setGateLight(LANE_ID, { status: "OPEN", message: "Hold mode" }).catch(() => {});
        if (holdKeepAliveRef.current) clearInterval(holdKeepAliveRef.current);
        holdKeepAliveRef.current = setInterval(() => {
            setGateLight(LANE_ID, { status: "OPEN", message: "Hold mode" }).catch(() => {});
        }, 4000);
    }

    // Manual Gate Open: open gate without finalize/Success_View (Req 3.8, 3.9)
    // If in hold mode, no-op — hold takes priority (Req 4.5)
    function handleManualGateOpen() {
        if (gateContextRef.current === "hold") return;
        if (viewState !== "success") {
            openGate("manual", null);
        }
    }

    // Manual Gate Close: cancel timer, close gate (Req 3.5)
    function handleManualGateClose() {
        closeGate();
    }

    const isLostTicketApplied = Boolean(checkout.session?.is_lost);

    // Monthly subscribers exit for free: the fee engine waives their service fee to 0.
    // Such sessions skip the QR/cash flow entirely and finalize in one tap (see the
    // auto-finalize effect below). A monthly session that still owes money (e.g. a lost
    // ticket penalty) has amount > 0 and falls through to the normal payment flow.
    const isMonthlyFree = Boolean(checkout.session?.is_monthly) && Number(checkout.amount) === 0;
    // Guards the one-tap monthly finalize so it fires exactly once per loaded session.
    const monthlyFinalizeRef = useRef(false);
    // Bumped to re-trigger the monthly finalize after a failed attempt (manual retry).
    const [monthlyRetry, setMonthlyRetry] = useState(0);

    useEffect(() => {
        if (!sessionid) return undefined;
        // Guard against a session-switch race: if sessionid (or reloadNonce) changes
        // while this fetch is in flight, the stale response must not stomp the freshly
        // loaded state.
        let cancelled = false;
        setLoading(true);
        // Clear any held exit frame/plate from a previously viewed session
        setExitImage(null);
        setExitPlate(null);
        monthlyFinalizeRef.current = false;
        initiateCheckout(sessionid)
            .then((result) => {
                if (cancelled) return;
                if (!result?.data) throw new Error("No data received");
                const data = result.data;
                setCheckout({
                    amount: data.amount,
                    hours: data.hours,
                    serviceFee: data.serviceFee,
                    penaltyFee: data.penaltyFee,
                    session: data.session_details,
                });
                setLiveHours(data.hours);
            })
            .catch((err) => {
                if (cancelled) return;
                console.error("Checkout error:", err);
                const errorMsg = err.response?.data?.message || err.message || "Failed to load payment details";
                setError(errorMsg);
                toast.error(errorMsg);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [sessionid, reloadNonce]);

    // Live update current time and hours (duration)
    useEffect(() => {
        if (!checkout.session || !checkout.session.time_in) return;
        const interval = setInterval(() => {
            setCurrentTime(new Date());
            const checkInTime = new Date(checkout.session.time_in);
            const now = new Date();
            const diffMs = now - checkInTime;
            const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));
            setLiveHours(diffHours);
        }, 1000); // update every second
        return () => clearInterval(interval);
    }, [checkout.session]);

    useEffect(() => {
        if (regenerateCooldown <= 0) return undefined;
        const timer = setInterval(() => {
            setRegenerateCooldown((prev) => Math.max(0, prev - 1));
        }, 1000);
        return () => clearInterval(timer);
    }, [regenerateCooldown]);

    // Cash Checkout Action — single button: finalize + open gate + Success_View
    // (Req 1.2, 1.3, 1.4, 1.5, 1.6, 1.7)
    const handleCashCheckout = async () => {
        if (!checkout.session) {
            toast.error("No checkout session to confirm");
            return;
        }

        // Req 1.5: disable button + processing indicator
        setViewState("processing");

        // Use the exit frame already captured on arrival (or recaptured by the
        // operator). Fall back to a fresh grab if none is held yet.
        const imageOut = exitImage || captureExitImage() || "";

        // Req 1.3, 1.4: Promise.race with 10s timeout + cancelled flag for late responses
        let cancelled = false;
        try {
            const result = await Promise.race([
                confirmCheckout(sessionid, "CASH", imageOut),
                new Promise((_, reject) =>
                    setTimeout(() => {
                        cancelled = true;
                        reject(new Error("Request timed out. Please try again."));
                    }, CASH_CONFIRM_TIMEOUT_MS)
                ),
            ]);

            // Req 1.4: if timeout already fired, ignore late success
            if (cancelled) return;

            // Req 1.3: success within 10s → open gate + Success_View
            const detail = {
                license_plate: checkout.session.license_plate,
                duration_hours: liveHours ?? checkout.hours,
                amount: result.amount ?? checkout.amount,
                is_monthly: checkout.session.is_monthly,
                payment_method: "CASH",
            };
            openGate("checkout", detail);

            // Req 1.6: keep button disabled (viewState stays "success", not reset to "input")
        } catch (err) {
            // Req 1.4: late response after timeout already set cancelled=true
            if (cancelled) return;

            // Req 1.7: show error toast, keep gate closed, re-enable button for retry
            const message = err.response?.data?.message || err.message || "Failed to confirm payment";
            toast.error(message);
            setViewState("input");
        }
    };

    // F2 hotkey → one-press cash checkout (force CASH + finalize + open gate). Reassigned
    // every render so the once-bound key listener always runs the latest logic. A physical
    // USB button emitting F2 (HID keyboard wedge) drives the exact same path; a future
    // COM/serial button would feed this same handler from its own listener.
    cashHotkeyRef.current = () => {
        if (!sessionid || viewState !== "input" || isMonthlyFree) return;
        // Mirror the Confirm Cash button's disabled guard: don't finalize while an
        // unapplied lost-ticket form is open.
        if (showLostTicketForm && !isLostTicket) return;
        setPaymentMethod("CASH");
        handleCashCheckout();
    };

    useEffect(() => {
        const onKey = (e) => {
            if (e.key !== "F2") return;
            // F2 is a function key (never a text character), so handle it even while the
            // always-focused RFID reader box has focus. preventDefault stops any browser
            // default from firing.
            e.preventDefault();
            cashHotkeyRef.current?.();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    const handleLostTicketToggle = () => {
        setShowLostTicketForm((prev) => !prev);
        setIsLostTicket((prev) => !prev);
        // Reset form fields if closing
        if (showLostTicketForm) {
            setGuestIdImage(null);
            setGuestPhone("");
        }
    };

    // Capture the live exit frame and run LPD so the operator can quickly đối chiếu
    // the detected exit plate against the session's stored check-in plate.
    // Also holds the captured frame as the pending exit image.
    const handleDetectExitPlate = async () => {
        const imageBase64 = captureExitImage();
        if (!imageBase64) {
            toast.error("Could not capture exit image from camera");
            return;
        }
        setDetectingExitPlate(true);
        setExitPlate(null);
        try {
            const result = await detectLicensePlate(imageBase64);
            setExitPlate(result.normalized_plate);
        } catch (err) {
            toast.error(err.message || "Plate detection failed");
        } finally {
            setDetectingExitPlate(false);
        }
    };

    const handleIdImageChange = async (e) => {
        const file = e.target.files[0];
        if (!file) {
            setGuestIdImage(null);
            return;
        }
        // Normalize any browser-decodable image to JPEG via canvas.
        // Rejects formats the browser can't decode (e.g. HEIC on desktop Chrome).
        try {
            const bitmap = await createImageBitmap(file);
            const canvas = document.createElement("canvas");
            canvas.width = bitmap.width;
            canvas.height = bitmap.height;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(bitmap, 0, 0);
            const jpegDataUrl = canvas.toDataURL("image/jpeg", 0.85);
            setGuestIdImage(jpegDataUrl);
        } catch {
            toast.error("Unsupported image format. Please use JPG or PNG.");
            e.target.value = "";
            setGuestIdImage(null);
        }
    };

    const handleGuestPhoneChange = (e) => {
        setGuestPhone(e.target.value);
    };

    const getTotalAmount = () => {
        return checkout.amount || 0;
    };

    const applyIntentResult = (intentPayload, shouldCancel = () => !isMountedRef.current) => {
        if (shouldCancel()) return;
        const activeAttempt = intentPayload?.active_attempt || intentPayload || null;

        setPaymentIntent(activeAttempt);
        setCheckout((prev) => ({
            ...prev,
            amount: intentPayload?.amount ?? prev.amount,
            serviceFee: intentPayload?.service_fee ?? prev.serviceFee,
            penaltyFee: intentPayload?.penalty_fee ?? prev.penaltyFee,
            hours: intentPayload?.hours ?? prev.hours,
        }));
        setCardStatus(intentPayload?.intent_status || intentPayload?.status || "PENDING");
        setEmbedVersion((v) => v + 1);
    };

    const ensureCardIntent = async ({ forceNew = false, shouldCancel = () => !isMountedRef.current }) => {
        if (!sessionid) return;
        if (shouldCancel()) return;
        setCreatingIntent(true);
        try {
            const amount = getTotalAmount();
            const key = makeIdempotencyKey(forceNew ? "regen" : "create", sessionid);
            const intent = forceNew
                ? await regeneratePaymentIntent(sessionid, key, amount)
                : await createPaymentIntent(sessionid, key, amount);
            if (shouldCancel()) return;
            applyIntentResult(intent, shouldCancel);
        } catch (err) {
            if (!shouldCancel()) {
                toast.error(err.response?.data?.message || "Failed to prepare payment intent");
            }
        } finally {
            if (!shouldCancel()) {
                setCreatingIntent(false);
            }
        }
    };

    useEffect(() => {
        if (!sessionid || !checkout.session || paymentMethod !== "CARD") return;
        // Monthly-free sessions owe nothing — never create a PayOS intent for amount 0
        // (PayOS rejects it). They finalize via the one-tap monthly effect below.
        if (isMonthlyFree) return;
        let isCancelled = false;

        const resumeOrCreate = async () => {
            setCreatingIntent(true);
            try {
                const statusResult = await fetchPaymentStatus(sessionid);
                if (isCancelled) return;

                const currentStatus = statusResult?.intent_status || statusResult?.status || "NOT_FOUND";
                const activeAttempt = statusResult?.active_attempt || null;
                const expectedAmount = getTotalAmount();
                const comparableAmount = statusResult?.intent?.amount ?? activeAttempt?.amount;
                const canReuse = isReusableAttempt({
                    attempt: activeAttempt,
                    intentAmount: comparableAmount,
                    expectedAmount,
                });

                if (currentStatus === "PAID") {
                    applyIntentResult(statusResult, () => isCancelled || !isMountedRef.current);
                } else if (canReuse) {
                    applyIntentResult(statusResult, () => isCancelled || !isMountedRef.current);
                } else if (
                    activeAttempt ||
                    ["NOT_FOUND", "REQUIRES_PAYMENT_METHOD", "FAILED", "EXPIRED", "PENDING"].includes(currentStatus)
                ) {
                    await ensureCardIntent({ forceNew: false, shouldCancel: () => isCancelled || !isMountedRef.current });
                }
            } catch (err) {
                if (!isCancelled) {
                    toast.error(err.response?.data?.message || "Failed to resume payment status");
                }
            } finally {
                if (!isCancelled) {
                    setCreatingIntent(false);
                }
            }
        };

        resumeOrCreate();
        return () => {
            isCancelled = true;
        };
    }, [sessionid, paymentMethod, checkout.session]);

    useEffect(() => {
        if (paymentMethod !== "CARD" || !sessionid || !checkout.session) return undefined;
        if (isMonthlyFree) return undefined;

        const timer = setInterval(async () => {
            try {
                const statusResult = await fetchPaymentStatus(sessionid);
                const nextStatus = statusResult?.intent_status || statusResult?.status || "PENDING";
                setCardStatus(nextStatus);

                if (statusResult?.active_attempt && statusResult?.active_attempt?.attempt_id !== paymentIntent?.attempt_id) {
                    setPaymentIntent(statusResult.active_attempt);
                }

                if (nextStatus === "PAID") {
                    // Req 2.1, 2.2, 2.3: stop polling, open gate + Success_View
                    clearInterval(timer);

                    // Persist the exit frame captured on arrival. The PayOS webhook
                    // finalizes the session server-side and has no access to the
                    // operator's camera, so the browser uploads the held image here.
                    // Read from the ref (not the closure) so a recapture between polls
                    // uploads the latest frame, not the one bound at interval creation.
                    const imageOut = exitImageRef.current || captureExitImage();
                    if (imageOut) {
                        uploadExitImage(sessionid, imageOut).catch(() => {
                            // Non-blocking: image is supplementary evidence, don't
                            // hold up the gate on an upload failure.
                        });
                    }

                    toast.success("Card payment confirmed");
                    const detail = {
                        license_plate: checkout.session.license_plate,
                        duration_hours: liveHours ?? checkout.hours,
                        amount: getTotalAmount(),
                        is_monthly: checkout.session.is_monthly,
                        payment_method: "CARD",
                    };
                    openGate("checkout", detail);
                } else if (nextStatus === "FAILED" || nextStatus === "EXPIRED") {
                    // Req 2.5: stop polling, show payment_failed, keep gate closed, keep session open
                    clearInterval(timer);
                    setViewState("payment_failed");
                }
            } catch (err) {
                // Req 2.6: network/server error → keep gate closed, don't stop interval, retry next cycle
            }
        }, 3000);

        return () => clearInterval(timer);
    }, [paymentMethod, paymentIntent?.attempt_id, sessionid, checkout.session, checkout.hours, liveHours]);

    // One-tap monthly checkout (Req: subscriber exits for free, no QR/cash, gate opens).
    // When a fee-waived monthly session loads, finalize it directly: grab the exit frame
    // (giving the camera a brief moment to warm up), settle server-side, then open the gate.
    // The image is supplementary — a missing frame never blocks the exit.
    // EXCEPTION: if session was loaded via "Process" button (manualProcessRef), skip
    // auto-finalize so the operator can review first.
    useEffect(() => {
        if (!isMonthlyFree || !sessionid || !checkout.session) return undefined;
        if (monthlyFinalizeRef.current) return undefined;
        if (manualProcessRef.current) return undefined;
        monthlyFinalizeRef.current = true;

        let timer = null;
        const finalize = async () => {
            setViewState("processing");
            const imageOut = exitImage || captureExitImage() || "";
            if (!imageOut) {
                // Camera wasn't ready within the grace window. The exit frame is
                // supplementary (never blocks the gate), but log it so a consistently
                // missing frame is diagnosable rather than silent.
                console.warn("[Checkout] Monthly auto-finalize: no exit frame captured within grace window");
            }
            try {
                await confirmMonthlyCheckout(sessionid, imageOut);
                if (!isMountedRef.current) return;
                toast.success("Monthly pass — exit approved");
                openGate("checkout", {
                    license_plate: checkout.session.license_plate,
                    duration_hours: liveHours ?? checkout.hours,
                    amount: 0,
                    is_monthly: true,
                    payment_method: "MONTHLY",
                });
            } catch (err) {
                if (!isMountedRef.current) return;
                toast.error(err.response?.data?.message || "Monthly checkout failed");
                // Allow a manual retry from the monthly panel
                monthlyFinalizeRef.current = false;
                setViewState("input");
            }
        };

        // ~800ms grace so the live exit frame is captured before finalizing
        timer = setTimeout(finalize, 800);
        return () => {
            if (timer) clearTimeout(timer);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isMonthlyFree, sessionid, checkout.session, monthlyRetry]);

    const formatDateTime = (dateStr) => {
        if (!dateStr) return "N/A";
        const date = new Date(dateStr);
        return date.toLocaleString();
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "VND",
            minimumFractionDigits: 0,
        }).format(amount);
    };

    // Re-fetch checkout data in place (no full page reload, which would destroy the
    // camera stream, gate state/timer, hold-mode context and customer-display channel).
    // Resets the payment intent because a fee change invalidates any pending QR.
    const refreshCheckout = () => {
        setPaymentIntent(null);
        setCardStatus("PENDING");
        setReloadNonce((n) => n + 1);
    };

    const handleLostTicketSubmit = async (e) => {
        e.preventDefault();
        if (!guestIdImage || !guestPhone) {
            toast.error("Please provide both ID card photo and phone number");
            return;
        }
        setReportingLost(true);
        try {
            // guestIdImage is already a normalized JPEG data URL from handleIdImageChange
            await reportLostTicket({
                session_id: sessionid,
                guest_identification: guestIdImage,
                guest_phone: guestPhone,
            });
            toast.success("Lost ticket reported. Penalty fee applied.");
            setShowLostTicketForm(false);
            setIsLostTicket(true);
            refreshCheckout();
        } catch (err) {
            const message = err.response?.data?.message || "Failed to report lost ticket";
            if (message === "A lost ticket report already exists for this session") {
                toast.error("This session already has a lost ticket report");
                setShowLostTicketForm(false);
                setIsLostTicket(true);
            } else if (message === "Session not found") {
                toast.error("Invalid session ID");
            } else {
                toast.error(message);
            }
        } finally {
            setReportingLost(false);
        }
    };

    const handleRemoveLostTicket = async () => {
        setLoading(true);
        try {
            await deleteLostTicket(sessionid);
            toast.success("Lost ticket state removed");
            setIsLostTicket(false);
            refreshCheckout();
        } catch (err) {
            toast.error(err.response?.data?.message || "Failed to remove lost ticket");
            setLoading(false);
        }
    };

    // ── Customer-facing display sync (Option A: same-machine 2nd window) ──
    // Broadcast the checkout/payment state to a read-only customer window that
    // the operator opens on a second screen. No backend involvement.
    const displayState = useMemo(
        () => ({
            idle: !sessionid,
            sessionId: sessionid,
            method: paymentMethod,
            amount: checkout.amount || 0,
            checkoutUrl: paymentMethod === "CARD" ? paymentIntent?.checkout_url || null : null,
            status: viewState === "success" ? "PAID" : cardStatus,
            paid: viewState === "success",
            embedVersion,
            plate: checkout.session?.license_plate || null,
            vehicleType: checkout.session?.vehicle_type || null,
            durationHours: liveHours ?? checkout.hours ?? null,
            isMonthly: Boolean(checkout.session?.is_monthly),
        }),
        [
            sessionid,
            paymentMethod,
            checkout.amount,
            paymentIntent?.checkout_url,
            viewState,
            cardStatus,
            embedVersion,
            checkout.session,
            liveHours,
            checkout.hours,
        ]
    );

    const latestDisplayStateRef = useRef(displayState);
    latestDisplayStateRef.current = displayState;

    const postToCustomerDisplay = useBroadcastChannel(CFD_CHANNEL, (msg) => {
        // A freshly opened customer window asks for the current state.
        if (msg?.type === CFD_MSG.HELLO) {
            postToCustomerDisplay({ type: CFD_MSG.STATE, payload: latestDisplayStateRef.current });
        }
    });

    useEffect(() => {
        postToCustomerDisplay({ type: CFD_MSG.STATE, payload: displayState });
    }, [displayState, postToCustomerDisplay]);

    const openCustomerDisplay = () => {
        if (typeof window === "undefined") return;
        window.open(`/employee/checkout/customer`, `cfd`, "width=720,height=1000");
    };

    // Idle terminal — waiting for a card to resolve an active session. No navigation
    // between states; scan resolves session → redirect adds ?session= → active view.
    if (!sessionid) {
        return (
            <main className="mx-auto max-w-6xl p-6 bg-white text-slate-800 rounded-2xl border border-gray-200 shadow-sm my-4">
                <header className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-gray-150 pb-4 mb-6 gap-3">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${gateState === "open" ? "bg-emerald-500 animate-pulse" : "bg-indigo-600"}`} />
                            <h1 className="text-xl font-bold uppercase tracking-wider text-slate-900 font-mono">
                                Checkout Terminal
                            </h1>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 text-xs font-mono">
                        <div className="bg-gray-50 border border-gray-200 px-3 py-1.5 rounded flex items-center gap-2 shadow-xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                            <span className="font-semibold tracking-wider text-[10px] uppercase text-slate-600">Ready to scan</span>
                        </div>
                        <button
                            type="button"
                            onClick={openCustomerDisplay}
                            className="px-3 py-1.5 cursor-pointer rounded-lg bg-indigo-600 text-white text-[10px] font-bold uppercase tracking-wider font-mono hover:bg-indigo-700 active:scale-[0.97] transition-all flex items-center gap-1.5 shrink-0"
                        >
                            <FaQrcode className="h-3.5 w-3.5" /> Customer Display
                        </button>
                    </div>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Live exit feed — kept mounted so the operator sees the lane while idle */}
                    <section className="lg:col-span-7 space-y-6">
                        <KioskCameraPanel ref={checkoutCameraRef} title="Exit Camera Feed" />
                    </section>

                    {/* Controls: gate, scan prompt, reader */}
                    <aside className="lg:col-span-5 space-y-6">
                        <GateStatusPanel
                            isOpen={gateState === "open"}
                            isHoldMode={gateContextRef.current === "hold"}
                            onManualOpen={handleManualGateOpen}
                            onHoldOpen={handleHoldOpen}
                            onManualClose={handleManualGateClose}
                        />

                        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50/60 p-8 text-center shadow-xs">
                            <FaCarSide className="h-10 w-10 text-gray-300 mb-3 animate-bounce" />
                            {switchingSession ? (
                                <p className="text-sm font-mono text-gray-600 animate-pulse">Looking up active session...</p>
                            ) : (
                                <>
                                    <p className="text-sm font-semibold text-slate-700">Tap or enter a card to begin checkout</p>
                                    <p className="text-xs text-slate-400 mt-1">Session details and images will appear once the card is read</p>
                                </>
                            )}
                        </div>

                        <ReaderPanel
                            key={resetKey}
                            value={scanUid}
                            onChange={(e) => setScanUid(e.target.value)}
                            onSubmit={handleScanCapture}
                            disabled={switchingSession}
                        />
                    </aside>
                </div>
            </main>
        );
    }

    if (loading) return <div className="p-8 text-center">Loading...</div>;
    if (error) return <div className="p-8 text-center text-red-600">{error}</div>;
    if (!checkout.session) return null;

    return (
        <main className="mx-auto max-w-6xl p-6 bg-white text-slate-800 rounded-2xl border border-gray-200 shadow-sm my-4">
            {/* Unified status header */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-gray-150 pb-4 mb-6 gap-3">
                <div>
                    <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${gateState === "open" ? "bg-emerald-500 animate-pulse" : "bg-indigo-600"}`} />
                        <h1 className="text-xl font-bold uppercase tracking-wider text-slate-900 font-mono">
                            Checkout Terminal
                        </h1>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
                    {/* Inline status readout */}
                    <div className={`px-3 py-1.5 rounded flex items-center gap-2 shadow-xs border transition-all duration-300 ${
                        viewState === "success"
                            ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                            : viewState === "processing"
                                ? "bg-blue-50 border-blue-200 text-blue-700"
                                : "bg-gray-50 border-gray-200 text-slate-600"
                    }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                            viewState === "success" ? "bg-emerald-500"
                                : viewState === "processing" ? "bg-blue-500 animate-pulse"
                                    : "bg-slate-400"
                        }`} />
                        <span className="font-semibold tracking-wider text-[10px] uppercase">
                            {viewState === "success" ? "Exit granted" : viewState === "processing" ? "Processing..." : "Awaiting payment"}
                        </span>
                    </div>

                    <div className="bg-gray-50 border border-gray-200 px-3 py-1.5 rounded flex items-center gap-2 text-slate-650 shadow-xs">
                        <span className="text-slate-400 uppercase tracking-widest text-[9px]">SESSION:</span>
                        <span className="font-bold text-slate-700">#{checkout.session.session_id}</span>
                    </div>
                    {checkout.session.license_plate && (
                        <div className="bg-gray-50 border border-gray-200 px-3 py-1.5 rounded flex items-center gap-2 text-slate-650 shadow-xs">
                            <span className="text-slate-400 uppercase tracking-widest text-[9px]">PLATE:</span>
                            <span className="font-bold text-slate-850">{checkout.session.license_plate}</span>
                        </div>
                    )}
                    {checkout.session.is_monthly && (
                        <span className="text-[9px] font-mono font-bold uppercase tracking-wider px-2.5 py-1.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">Monthly Pass</span>
                    )}
                    {isLostTicketApplied && (
                        <span className="text-[9px] font-mono font-bold uppercase tracking-wider px-2.5 py-1.5 rounded bg-rose-50 text-rose-700 border border-rose-200">Lost Ticket</span>
                    )}
                    <button
                        type="button"
                        onClick={openCustomerDisplay}
                        className="px-3 py-1.5 cursor-pointer rounded-lg bg-indigo-600 text-white text-[10px] font-bold uppercase tracking-wider font-mono hover:bg-indigo-700 active:scale-[0.97] transition-all flex items-center gap-1.5 shrink-0"
                    >
                        <FaQrcode className="h-3.5 w-3.5" /> Customer Display
                    </button>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* HERO — Visual comparison: live exit feed (top) + check-in image (bottom) */}
                <section className="lg:col-span-7 space-y-6">
                    {/* Live exit feed */}
                    <KioskCameraPanel
                        ref={checkoutCameraRef}
                        title="Live Exit Feed"
                        onReady={captureExitImage}
                        headerActions={
                            <button
                                type="button"
                                onClick={handleDetectExitPlate}
                                disabled={detectingExitPlate}
                                className="px-3 py-1.5 cursor-pointer bg-indigo-600 text-white rounded-lg text-[10px] font-semibold hover:bg-indigo-700 active:scale-[0.97] transition-all disabled:opacity-50 flex items-center gap-1.5 font-mono uppercase tracking-wider"
                            >
                                {detectingExitPlate ? (
                                    <>
                                        <FaSync className="animate-spin h-3 w-3" />
                                        Detecting…
                                    </>
                                ) : (
                                    <>
                                        <FaSync className="h-3 w-3" />
                                        Detect Plate
                                    </>
                                )}
                            </button>
                        }
                    />

                    {/* Plate comparison strip (only once a plate is detected) */}
                    {exitPlate && (() => {
                        const checkinPlate = checkout.session.license_plate || "";
                        const normalize = (p) => p.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
                        const isMatch = normalize(exitPlate) === normalize(checkinPlate);
                        return (
                            <div className={`rounded-xl border p-3 shadow-sm flex items-center justify-between gap-4 ${isMatch ? "bg-emerald-50 border-emerald-200" : "bg-rose-50 border-rose-200"}`}>
                                <div className="flex items-center gap-5 font-mono text-xs">
                                    <div>
                                        <span className="text-slate-500 uppercase tracking-widest text-[9px] block">Check-in</span>
                                        <span className="text-base font-bold text-slate-800">{checkinPlate || "N/A"}</span>
                                    </div>
                                    <span className="text-slate-300">→</span>
                                    <div>
                                        <span className="text-slate-500 uppercase tracking-widest text-[9px] block">Detected Exit</span>
                                        <span className="text-base font-bold text-slate-800">{exitPlate}</span>
                                    </div>
                                </div>
                                <span className={`text-[10px] font-bold font-mono tracking-widest px-2 py-1 rounded border uppercase ${isMatch ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-rose-100 text-rose-700 border-rose-200"}`}>
                                    {isMatch ? "Match" : "Mismatch"}
                                </span>
                            </div>
                        );
                    })()}

                    {/* Check-in reference image */}
                    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                        <div className="flex items-center gap-3 border-b border-gray-250/60 pb-3 mb-4">
                            <div className="p-2 rounded bg-indigo-50 text-indigo-600">
                                <FaImage className="h-5 w-5" />
                            </div>
                            <div>
                                <h2 className="text-sm font-semibold text-slate-800 uppercase tracking-wider">Check-in Reference</h2>
                                <p className="text-xs text-slate-500">Image captured at entry gate</p>
                            </div>
                        </div>
                        <div className="rounded-lg overflow-hidden border border-gray-100 bg-gray-50 flex items-center justify-center p-2 min-h-[220px] shadow-inner">
                            <SessionImage objectKey={checkout.session.image_in_url} type="in" sessionId={sessionid} />
                        </div>
                    </div>
                </section>

                {/* RIGHT RAIL — controls (compact) */}
                <aside className="lg:col-span-5 space-y-6">
                    {/* Gate status */}
                    <GateStatusPanel
                        isOpen={gateState === "open"}
                        isHoldMode={gateContextRef.current === "hold"}
                        onManualOpen={handleManualGateOpen}
                        onHoldOpen={handleHoldOpen}
                        onManualClose={handleManualGateClose}
                    />

                    {/* Billing summary (compact, breakdown collapsible) */}
                    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                        <div className="flex items-center gap-3 border-b border-gray-250/60 pb-3 mb-4">
                            <div className="p-2 rounded bg-emerald-50 text-emerald-600">
                                <FaMoneyBillWave className="h-5 w-5" />
                            </div>
                            <div>
                                <h2 className="text-sm font-semibold text-slate-800 uppercase tracking-wider">Billing Summary</h2>
                                <p className="text-xs text-slate-500">Calculated duration and fees</p>
                            </div>
                        </div>

                        <div className="bg-gray-50/50 p-4 rounded-lg border border-gray-200/80 mb-4">
                            <div className="flex items-end justify-between">
                                <div>
                                    <span className="text-slate-500 font-mono uppercase tracking-widest text-[9px] block">Grand Total</span>
                                    <span className="text-3xl font-black text-emerald-700 tracking-tight">{formatCurrency(getTotalAmount())}</span>
                                </div>
                                <div className="text-right font-mono">
                                    <span className="text-slate-500 uppercase tracking-widest text-[9px] block">Duration</span>
                                    <span className="text-lg font-bold text-slate-800">{liveHours ?? checkout.hours}h</span>
                                </div>
                            </div>
                        </div>

                        <details className="group">
                            <summary className="cursor-pointer list-none text-[10px] font-mono uppercase tracking-wider text-slate-400 hover:text-slate-600 flex items-center gap-1">
                                <span className="inline-block group-open:rotate-90 transition-transform">▸</span> Fee breakdown · in {formatDateTime(checkout.session.time_in)}
                            </summary>
                            <div className="mt-2 space-y-1.5 font-mono text-xs border-t border-gray-100 pt-2">
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Service Fee</span>
                                    <span className="text-slate-800">{formatCurrency(checkout.serviceFee)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Penalty Fee</span>
                                    <span className="text-rose-600">{formatCurrency(checkout.penaltyFee)}</span>
                                </div>
                            </div>
                        </details>
                    </section>

                    {/* Monthly subscriber — free one-tap exit (no payment method needed) */}
                    {isMonthlyFree && (
                        <section className="rounded-xl border border-emerald-250 bg-emerald-50/30 p-5 shadow-sm">
                            <div className="flex items-center gap-3 border-b border-emerald-200/60 pb-3 mb-4">
                                <div className="p-2 rounded bg-emerald-100 text-emerald-750">
                                    <FaRegCreditCard className="h-5 w-5" />
                                </div>
                                <div>
                                    <h2 className="text-sm font-semibold text-emerald-900 uppercase tracking-wider">Monthly Pass</h2>
                                    <p className="text-xs text-emerald-600">Active monthly subscription</p>
                                </div>
                            </div>
                            {viewState === "processing" ? (
                                <p className="flex items-center gap-2 text-xs text-emerald-700 font-mono">
                                    <FaSync className="animate-spin h-3 w-3 text-emerald-650" />
                                    Approving exit…
                                </p>
                            ) : viewState === "success" ? (
                                <p className="text-xs text-emerald-700 font-mono">Exit approved — gate opening.</p>
                            ) : (
                                <div className="space-y-3">
                                    <p className="text-[11px] text-emerald-700">
                                        Active subscription — no fee due. Confirm to open the exit gate.
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            manualProcessRef.current = false;
                                            monthlyFinalizeRef.current = false;
                                            setMonthlyRetry((n) => n + 1);
                                        }}
                                        className="px-3 py-2 cursor-pointer rounded-lg bg-emerald-605 hover:bg-emerald-700 text-white text-[10px] font-bold uppercase tracking-wider font-mono active:scale-[0.97] transition-all shadow-sm"
                                    >
                                        Confirm Exit
                                    </button>
                                </div>
                            )}
                        </section>
                    )}

                    {/* Payment method */}
                    {!isMonthlyFree && (
                    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                        <div className="flex items-center gap-3 border-b border-gray-250/60 pb-3 mb-4">
                            <div className="p-2 rounded bg-indigo-50 text-indigo-600">
                                <FaRegCreditCard className="h-5 w-5" />
                            </div>
                            <div>
                                <h2 className="text-sm font-semibold text-slate-800 uppercase tracking-wider">Payment Method</h2>
                                <p className="text-xs text-slate-500">Select cash or card/QR code</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 mb-4">
                            <button
                                type="button"
                                onClick={() => setPaymentMethod("CASH")}
                                className={`border cursor-pointer rounded-lg p-2.5 flex items-center gap-2 transition-all active:scale-[0.97] ${paymentMethod === "CASH" ? "bg-indigo-50/70 border-indigo-500 shadow-xs" : "bg-white border-gray-200 hover:bg-gray-50"}`}
                            >
                                <span className={`p-1.5 rounded-lg ${paymentMethod === "CASH" ? "bg-indigo-100 text-indigo-700" : "bg-gray-50 text-gray-400"}`}>
                                    <FaMoneyBillWave className="h-4 w-4" />
                                </span>
                                <span className={`text-xs font-bold ${paymentMethod === "CASH" ? "text-indigo-700" : "text-gray-700"}`}>Cash</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setPaymentMethod("CARD")}
                                className={`border cursor-pointer rounded-lg p-2.5 flex items-center gap-2 transition-all active:scale-[0.97] ${paymentMethod === "CARD" ? "bg-indigo-50/70 border-indigo-500 shadow-xs" : "bg-white border-gray-200 hover:bg-gray-50"}`}
                            >
                                <span className={`p-1.5 rounded-lg ${paymentMethod === "CARD" ? "bg-indigo-100 text-indigo-700" : "bg-gray-50 text-gray-400"}`}>
                                    <FaCreditCard className="h-4 w-4" />
                                </span>
                                <span className={`text-xs font-bold ${paymentMethod === "CARD" ? "text-indigo-700" : "text-gray-700"}`}>Card / QR</span>
                            </button>
                        </div>

                        {paymentMethod === "CARD" && (
                            <div className="border border-gray-200 rounded-lg p-3 bg-gray-50/60 space-y-2.5">
                                <div className="flex items-center gap-2 text-indigo-700">
                                    <FaQrcode className="h-4 w-4" />
                                    <p className="text-xs font-semibold">QR shown on the customer display</p>
                                </div>
                                {creatingIntent ? (
                                    <p className="flex items-center gap-2 text-xs text-slate-500 font-mono">
                                        <FaSync className="animate-spin h-3 w-3 text-indigo-600" />
                                        Generating QR…
                                    </p>
                                ) : (
                                    <p className="text-[11px] text-slate-500">Open the customer display so the driver can scan to pay.</p>
                                )}
                                <div className="flex items-center justify-between gap-2 pt-1">
                                    <button
                                        type="button"
                                        onClick={openCustomerDisplay}
                                        className="px-2.5 py-1.5 rounded-lg bg-indigo-600 text-white text-[10px] font-bold uppercase tracking-wider font-mono hover:bg-indigo-700 active:scale-[0.97] transition-all"
                                    >
                                        Open Display
                                    </button>
                                    <button
                                        type="button"
                                        disabled={creatingIntent || cardStatus === "PAID" || regenerateCooldown > 0}
                                        onClick={async () => {
                                            await ensureCardIntent({ forceNew: true });
                                            setRegenerateCooldown(8);
                                        }}
                                        className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 disabled:text-gray-400 transition-colors font-mono"
                                    >
                                        {regenerateCooldown > 0 ? `New QR (${regenerateCooldown}s)` : "New QR"}
                                    </button>
                                </div>
                                <div className="bg-white border border-gray-200 rounded-lg p-2 text-xs font-mono flex justify-between">
                                    <span className="text-slate-500 uppercase tracking-widest text-[9px]">Status</span>
                                    <span className="font-bold text-slate-800">{CARD_STATUS_LABELS[cardStatus] || cardStatus}</span>
                                </div>
                            </div>
                        )}

                        {viewState === "payment_failed" && (
                            <p className="mt-2 text-[11px] font-semibold text-rose-600">Payment failed or expired. Tap &quot;New QR&quot; to retry.</p>
                        )}
                    </section>
                    )}

                    {/* Action buttons - hidden during success (gate auto-closes & redirects) */}
                    {viewState !== "success" && (
                        <div className="flex gap-2">
                            <button
                                onClick={resetTerminal}
                                className="flex-1 cursor-pointer px-3 py-2.5 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-[11px] font-bold uppercase tracking-wider rounded-lg transition-all active:scale-[0.98] font-mono shadow-xs"
                            >
                                Cancel
                            </button>
                            {paymentMethod === "CASH" && (
                                <button
                                    onClick={handleCashCheckout}
                                    disabled={viewState === "processing" || viewState === "success" || (showLostTicketForm && !isLostTicket)}
                                    className="flex-[2] cursor-pointer px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-[11px] font-bold uppercase tracking-wider rounded-lg transition-all active:scale-[0.98] flex items-center justify-center gap-1.5 shadow-sm font-mono"
                                >
                                    {viewState === "processing" ? (
                                        <>
                                            <FaSync className="animate-spin h-3 w-3" />
                                            Processing…
                                        </>
                                    ) : (
                                        <>
                                            <FaCheckCircle className="h-3 w-3" />
                                            Confirm Cash
                                        </>
                                    )}
                                </button>
                            )}
                        </div>
                    )}
                    {viewState !== "success" && paymentMethod === "CASH" && (
                        <p className="text-[10px] font-mono text-slate-400 text-center -mt-1">
                            Shortcut <kbd className="px-1 py-0.5 rounded border border-gray-300 bg-gray-50 text-slate-650 font-bold">F2</kbd> — take cash &amp; open gate
                        </p>
                    )}

                    {/* RFID reader (slim) — same card recaptures, different card switches session */}
                    <ReaderPanel
                        value={scanUid}
                        onChange={(e) => setScanUid(e.target.value)}
                        onSubmit={handleScanCapture}
                        disabled={switchingSession}
                    />

                    {/* Lost ticket (small) */}
                    <div className="flex items-center justify-between gap-2 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl shadow-xs">
                        <span className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-slate-500">
                            <FaExclamationTriangle className={`h-3.5 w-3.5 ${isLostTicketApplied ? "text-rose-500" : "text-amber-500"}`} />
                            {isLostTicketApplied ? "Lost ticket penalty applied" : "Lost ticket?"}
                        </span>
                        {isLostTicketApplied ? (
                            <button
                                onClick={handleRemoveLostTicket}
                                disabled={loading}
                                className="px-3 py-1 cursor-pointer text-[10px] font-bold uppercase tracking-wider rounded-lg bg-rose-50 text-rose-700 border border-rose-250 hover:bg-rose-100 transition-all active:scale-[0.97] font-mono"
                            >
                                Remove
                            </button>
                        ) : (
                            <button
                                onClick={handleLostTicketToggle}
                                className="px-3 py-1 cursor-pointer text-[10px] font-bold uppercase tracking-wider rounded-lg bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 transition-all active:scale-[0.97] font-mono shadow-2xs"
                            >
                                Report
                            </button>
                        )}
                    </div>
                </aside>
            </div>

            {/* Lost ticket modal */}
            {showLostTicketForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
                    <form onSubmit={handleLostTicketSubmit} className="bg-white rounded-2xl p-6 shadow-xl w-full max-w-md space-y-4 border border-gray-100">
                        <div className="flex items-center justify-between border-b border-gray-250/60 pb-3 mb-4">
                            <span className="flex items-center gap-2 font-semibold text-xs uppercase tracking-wider font-mono text-amber-800">
                                <FaIdCard className="text-amber-600" />
                                Lost Ticket Details
                            </span>
                            <button type="button" onClick={handleLostTicketToggle} className="text-slate-450 hover:text-slate-700 text-xl leading-none cursor-pointer">×</button>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold font-mono uppercase tracking-wider text-slate-500 mb-1.5">Guest ID Card Photo</label>
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleIdImageChange}
                                className="block w-full text-xs text-slate-650 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 file:cursor-pointer"
                            />
                            {guestIdImage && <span className="text-[10px] text-slate-400 font-mono mt-1 block">{guestIdImage.name}</span>}
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold font-mono uppercase tracking-wider text-slate-500 mb-1.5">Guest Phone</label>
                            <input
                                type="tel"
                                value={guestPhone}
                                onChange={handleGuestPhoneChange}
                                className="block w-full border border-gray-250/80 rounded-lg p-2.5 text-slate-800 text-xs focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white font-mono"
                                placeholder="Enter guest phone number"
                            />
                        </div>
                        <div className="flex justify-end gap-2 pt-1">
                            <button type="button" onClick={handleLostTicketToggle} className="px-3 py-2 cursor-pointer text-xs font-semibold text-slate-500 hover:text-slate-700 font-mono uppercase tracking-wider">Cancel</button>
                            <button
                                type="submit"
                                disabled={reportingLost}
                                className="px-4 py-2 cursor-pointer bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-semibold shadow-xs active:scale-[0.98] transition-all disabled:opacity-50 font-mono uppercase tracking-wider"
                            >
                                {reportingLost ? "Reporting…" : "Apply Penalty"}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Success overlay */}
            {viewState === "success" && successDetail && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" data-testid="success-view">
                    <div className="bg-white rounded-2xl p-8 shadow-xl w-full max-w-md text-center">
                        <div className="flex items-center justify-center mb-4">
                            <div className="bg-green-100 rounded-full p-3">
                                <FaCheckCircle className="h-10 w-10 text-green-600" />
                            </div>
                        </div>
                        <h3 className="text-xl font-semibold text-green-800 mb-1">Payment Completed</h3>
                        <p className="text-green-700 mb-5 text-sm">Vehicle checked out. Gate is open.</p>
                        <div className="grid grid-cols-2 gap-4 text-sm text-left">
                            <div>
                                <p className="text-[10px] font-bold font-mono uppercase tracking-wider text-slate-500 mb-0.5">License Plate</p>
                                <p className="font-semibold text-slate-800">{successDetail.license_plate}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold font-mono uppercase tracking-wider text-slate-500 mb-0.5">Duration</p>
                                <p className="font-semibold text-slate-800">{successDetail.duration_hours} hours</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold font-mono uppercase tracking-wider text-slate-500 mb-0.5">Amount</p>
                                <p className="font-semibold text-slate-800">
                                    {formatCurrency(successDetail.amount)}
                                    {successDetail.is_monthly && " (Monthly)"}
                                </p>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold font-mono uppercase tracking-wider text-slate-500 mb-0.5">Method</p>
                                <p className="font-semibold text-slate-800 flex items-center">
                                    {successDetail.payment_method === "CASH" ? (
                                        <>
                                            <FaMoneyBillWave className="mr-1.5 text-green-600" />
                                            Cash
                                        </>
                                    ) : (
                                        <>
                                            <FaCreditCard className="mr-1.5 text-green-600" />
                                            Card
                                        </>
                                    )}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}

export default function CheckoutTerminalPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>}>
            <CheckoutTerminalContent />
        </Suspense>
    );
}
