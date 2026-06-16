"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import {
    initiateCheckout,
    confirmCheckout,
    reportLostTicket,
    deleteLostTicket,
    createPaymentIntent,
    regeneratePaymentIntent,
    fetchPaymentStatus,
    uploadExitImage,
    findActiveSessionByCard,
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
} from "react-icons/fa";
import SessionImage from "@/app/components/common/SessionImage";
import KioskCameraPanel from "@/app/employee/checkin/components/KioskCameraPanel";
import GateStatusPanel from "@/app/employee/checkin/components/GateStatusPanel";
import ReaderPanel from "@/app/employee/checkin/components/ReaderPanel";
import { detectLicensePlate } from "@/app/api/employee.lpd.client";
import { fetchEmployeeGateSettings } from "@/app/api/admin.gateSettings.client";
import { fetchEmployeeCheckoutSettings } from "@/app/api/admin.checkoutSettings.client";
import { CFD_MSG, CFD_CHANNEL, useBroadcastChannel } from "../cfdChannel";

const CARD_STATUS_LABELS = {
    PENDING: "Pending payment",
    PAID: "Paid",
    FAILED: "Payment failed",
    EXPIRED: "Payment expired",
    NOT_FOUND: "No active payment intent",
    REQUIRES_PAYMENT_METHOD: "Requires payment method",
};

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

export default function PaymentDetailsPage() {
    const params = useParams();
    const sessionid = params.sessionid;
    const toast = useToast();
    const router = useRouter();

    // State: loading, error, checkout, payment method
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
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

    // Gate state machine (matches kiosk check-in pattern)
    const [gateState, setGateState] = useState("shut");
    const gateTimerRef = useRef(null);
    const gateContextRef = useRef(null); // "checkout" | "manual" | "hold" | null

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

    // Card-scan field on the terminal. Dual-purpose:
    //  - same card as the current session  → recapture the exit frame
    //  - a different card                  → resolve that card's session and switch to it
    const [scanUid, setScanUid] = useState("");
    const [switchingSession, setSwitchingSession] = useState(false);

    // Grab the current live frame and hold it as the pending exit image.
    // Returns the captured base64 (or null) so callers can chain on it.
    const captureExitImage = () => {
        const frame = checkoutCameraRef.current?.capture();
        if (frame) setExitImage(frame);
        return frame || null;
    };

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
                router.push(`/employee/checkout/${session_id}`);
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
        };
    }, []);

    // Guard ref to prevent double navigation in closeGate
    const closeGateNavigatingRef = useRef(false);

    // Gate control functions (Requirements 3.2, 3.4, 3.10)
    function openGate(context, detail) {
        setGateState("open");
        gateContextRef.current = context;
        if (detail) {
            setViewState("success");
            setSuccessDetail(detail);
        }
        if (gateTimerRef.current) clearTimeout(gateTimerRef.current);
        gateTimerRef.current = setTimeout(closeGate, autoCloseDurationMs);
    }

    function closeGate() {
        if (gateTimerRef.current) clearTimeout(gateTimerRef.current);
        gateTimerRef.current = null;
        setGateState("shut");

        if (gateContextRef.current === "checkout") {
            // Navigate exactly once back to checkout input screen
            if (!closeGateNavigatingRef.current) {
                closeGateNavigatingRef.current = true;
                router.replace("/employee/checkout");
            }
        } else {
            // Manual context: stay on page, reset view
            setViewState("input");
        }
        gateContextRef.current = null;
    }

    // Hold-mode open: no timer started (Req 4.1, 4.2, 4.3, 4.6)
    function handleHoldOpen() {
        if (gateTimerRef.current) clearTimeout(gateTimerRef.current);
        gateTimerRef.current = null;
        setGateState("open");
        gateContextRef.current = "hold";
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

    useEffect(() => {
        if (!sessionid) return;
        setLoading(true);
        // Clear any held exit frame/plate from a previously viewed session
        setExitImage(null);
        setExitPlate(null);
        initiateCheckout(sessionid)
            .then((result) => {
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
                console.error("Checkout error:", err);
                const errorMsg = err.response?.data?.message || err.message || "Failed to load payment details";
                setError(errorMsg);
                toast.error(errorMsg);
            })
            .finally(() => setLoading(false));
    }, [sessionid]);

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

    const handleIdImageChange = (e) => {
        setGuestIdImage(e.target.files[0]);
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
                    const imageOut = exitImage || captureExitImage();
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

    const handleLostTicketSubmit = async (e) => {
        e.preventDefault();
        if (!guestIdImage || !guestPhone) {
            toast.error("Please provide both ID card photo and phone number");
            return;
        }
        setReportingLost(true);
        try {
            // Convert image to base64 (or use FormData if backend expects file)
            const toBase64 = (file) =>
                new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.readAsDataURL(file);
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = (error) => reject(error);
                });
            const guest_identification = await toBase64(guestIdImage);
            await reportLostTicket({
                session_id: sessionid,
                guest_identification,
                guest_phone: guestPhone,
            });
            toast.success("Lost ticket reported. Penalty fee applied.");
            setShowLostTicketForm(false);
            setIsLostTicket(true);
            window.location.reload();
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
            window.location.reload();
        } catch (err) {
            toast.error(err.response?.data?.message || "Failed to remove lost ticket");
        } finally {
            setLoading(false);
        }
    };

    // ── Customer-facing display sync (Option A: same-machine 2nd window) ──
    // Broadcast the checkout/payment state to a read-only customer window that
    // the operator opens on a second screen. No backend involvement.
    const displayState = useMemo(
        () => ({
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

    if (loading) return <div className="p-8 text-center">Loading...</div>;
    if (error) return <div className="p-8 text-center text-red-600">{error}</div>;
    if (!checkout.session) return null;

    return (
        <main className="min-h-screen bg-slate-50 text-slate-800 p-4">
            {/* Slim status bar — replaces the old "Checkout Terminal / UNIFIED GATEWAY" header */}
            <header className="flex items-center justify-between gap-3 mb-4 bg-white border border-gray-200 rounded-xl px-4 py-2.5 shadow-sm">
                <div className="flex items-center gap-3 min-w-0">
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${gateState === "open" ? "bg-emerald-500 animate-pulse" : "bg-indigo-600"}`} />
                    <h1 className="text-sm font-bold uppercase tracking-wider font-mono text-slate-900">Checkout</h1>
                    <span className="text-xs font-mono text-slate-400">#{checkout.session.session_id}</span>
                    <span className="text-sm font-mono font-bold text-slate-800 truncate">{checkout.session.license_plate || "N/A"}</span>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 capitalize hidden sm:inline">{checkout.session.vehicle_type}</span>
                    {checkout.session.is_monthly && (
                        <span className="text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">Monthly</span>
                    )}
                    {isLostTicketApplied && (
                        <span className="text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">Lost</span>
                    )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs font-mono text-slate-500 tracking-widest hidden md:inline">{currentTime.toLocaleTimeString()}</span>
                    <button
                        type="button"
                        onClick={openCustomerDisplay}
                        className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-[10px] font-bold uppercase tracking-wider font-mono hover:bg-indigo-700 active:scale-[0.97] transition-all flex items-center gap-1.5"
                    >
                        <FaQrcode className="h-3.5 w-3.5" /> Customer Display
                    </button>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* HERO — Visual comparison: live exit feed (top) + check-in image (bottom) */}
                <section className="lg:col-span-8 space-y-4">
                    {/* Live exit feed */}
                    <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
                                <h2 className="text-xs font-semibold uppercase tracking-wider font-mono text-slate-800">Live Exit Feed</h2>
                                <span className="text-[9px] font-bold font-mono tracking-widest px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100 uppercase">Live</span>
                            </div>
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
                        </div>
                        <KioskCameraPanel ref={checkoutCameraRef} onReady={captureExitImage} />
                    </div>

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
                    <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
                        <div className="flex items-center gap-2 mb-2">
                            <FaImage className="text-indigo-600 h-3.5 w-3.5" />
                            <h2 className="text-xs font-semibold uppercase tracking-wider font-mono text-slate-800">Check-in Reference</h2>
                        </div>
                        <div className="rounded-lg overflow-hidden border border-gray-100 bg-gray-50 flex items-center justify-center p-2 min-h-[220px]">
                            <SessionImage objectKey={checkout.session.image_in_url} type="in" sessionId={sessionid} />
                        </div>
                    </div>
                </section>

                {/* RIGHT RAIL — controls (compact) */}
                <aside className="lg:col-span-4 space-y-4">
                    {/* Gate status */}
                    <GateStatusPanel
                        isOpen={gateState === "open"}
                        isHoldMode={gateContextRef.current === "hold"}
                        onManualOpen={handleManualGateOpen}
                        onHoldOpen={handleHoldOpen}
                        onManualClose={handleManualGateClose}
                    />

                    {/* Billing summary (compact, breakdown collapsible) */}
                    <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                        <div className="flex items-end justify-between mb-3">
                            <div>
                                <span className="text-slate-500 font-mono uppercase tracking-widest text-[9px] block">Grand Total</span>
                                <span className="text-3xl font-black text-emerald-700 tracking-tight">{formatCurrency(getTotalAmount())}</span>
                            </div>
                            <div className="text-right font-mono">
                                <span className="text-slate-500 uppercase tracking-widest text-[9px] block">Duration</span>
                                <span className="text-lg font-bold text-slate-800">{liveHours ?? checkout.hours}h</span>
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

                    {/* Payment method */}
                    <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                        <div className="flex items-center gap-2 border-b border-gray-150 pb-2 mb-3">
                            <FaRegCreditCard className="text-indigo-600 h-3.5 w-3.5" />
                            <h2 className="text-xs font-semibold uppercase tracking-wider font-mono text-slate-800">Payment Method</h2>
                        </div>
                        <div className="grid grid-cols-2 gap-2 mb-3">
                            <button
                                type="button"
                                onClick={() => setPaymentMethod("CASH")}
                                className={`border rounded-lg p-2.5 flex items-center gap-2 transition-all active:scale-[0.97] ${paymentMethod === "CASH" ? "bg-indigo-50/70 border-indigo-500" : "bg-white border-gray-200 hover:bg-gray-50"}`}
                            >
                                <span className={`p-1.5 rounded-lg ${paymentMethod === "CASH" ? "bg-indigo-100 text-indigo-700" : "bg-gray-50 text-gray-400"}`}>
                                    <FaMoneyBillWave className="h-4 w-4" />
                                </span>
                                <span className={`text-xs font-bold ${paymentMethod === "CASH" ? "text-indigo-700" : "text-gray-700"}`}>Cash</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setPaymentMethod("CARD")}
                                className={`border rounded-lg p-2.5 flex items-center gap-2 transition-all active:scale-[0.97] ${paymentMethod === "CARD" ? "bg-indigo-50/70 border-indigo-500" : "bg-white border-gray-200 hover:bg-gray-50"}`}
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
                            <p className="mt-2 text-[11px] font-semibold text-rose-600">Payment failed or expired. Tap “New QR” to retry.</p>
                        )}
                    </section>

                    {/* Action buttons — hidden during success (gate auto-closes & redirects) */}
                    {viewState !== "success" && (
                        <div className="flex gap-2">
                            <button
                                onClick={() => router.replace("/employee/checkout")}
                                className="flex-1 px-3 py-2.5 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-[11px] font-bold uppercase tracking-wider rounded-xl transition-all active:scale-[0.98] font-mono"
                            >
                                Cancel
                            </button>
                            {paymentMethod === "CASH" && (
                                <button
                                    onClick={handleCashCheckout}
                                    disabled={viewState === "processing" || viewState === "success" || (showLostTicketForm && !isLostTicket)}
                                    className="flex-[2] px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-[11px] font-bold uppercase tracking-wider rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-1.5 shadow-sm font-mono"
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

                    {/* RFID reader (slim) — same card recaptures, different card switches session */}
                    <ReaderPanel
                        value={scanUid}
                        onChange={(e) => setScanUid(e.target.value)}
                        onSubmit={handleScanCapture}
                        disabled={switchingSession}
                    />

                    {/* Lost ticket (small) */}
                    <div className="flex items-center justify-between gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl">
                        <span className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-slate-500">
                            <FaExclamationTriangle className={`h-3.5 w-3.5 ${isLostTicketApplied ? "text-rose-500" : "text-amber-500"}`} />
                            {isLostTicketApplied ? "Lost ticket penalty applied" : "Lost ticket?"}
                        </span>
                        {isLostTicketApplied ? (
                            <button
                                onClick={handleRemoveLostTicket}
                                disabled={loading}
                                className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-lg bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition-all active:scale-[0.97] font-mono"
                            >
                                Remove
                            </button>
                        ) : (
                            <button
                                onClick={handleLostTicketToggle}
                                className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-lg bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 transition-all active:scale-[0.97] font-mono"
                            >
                                Report
                            </button>
                        )}
                    </div>
                </aside>
            </div>

            {/* Lost ticket modal */}
            {showLostTicketForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <form onSubmit={handleLostTicketSubmit} className="bg-white rounded-xl p-5 shadow-xl w-full max-w-md space-y-4">
                        <div className="flex items-center justify-between border-b border-gray-150 pb-2">
                            <span className="flex items-center gap-2 font-semibold text-xs uppercase tracking-wider font-mono text-amber-800">
                                <FaIdCard className="text-amber-600" />
                                Lost Ticket Details
                            </span>
                            <button type="button" onClick={handleLostTicketToggle} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold font-mono uppercase tracking-wider text-slate-500 mb-1">Guest ID Card Photo</label>
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleIdImageChange}
                                className="block w-full text-xs text-slate-650 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 file:cursor-pointer"
                            />
                            {guestIdImage && <span className="text-[10px] text-slate-400 font-mono mt-1 block">{guestIdImage.name}</span>}
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold font-mono uppercase tracking-wider text-slate-500 mb-1">Guest Phone</label>
                            <input
                                type="tel"
                                value={guestPhone}
                                onChange={handleGuestPhoneChange}
                                className="block w-full border border-gray-200 rounded-lg p-2.5 text-slate-800 text-xs focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
                                placeholder="Enter guest phone number"
                            />
                        </div>
                        <div className="flex justify-end gap-2 pt-1">
                            <button type="button" onClick={handleLostTicketToggle} className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 font-mono uppercase tracking-wider">Cancel</button>
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
