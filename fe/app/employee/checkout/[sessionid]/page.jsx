"use client";
import { useEffect, useRef, useState } from "react";
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
} from "@/app/api/employee.client";
import { useToast } from "@/app/components/providers/ToastProvider";
import {
    FaRegCreditCard,
    FaCar,
    FaRegClock,
    FaMoneyBillWave,
    FaCreditCard,
    FaCheckCircle,
    FaSync,
    FaIdCard,
    FaExclamationTriangle,
    FaImage,
} from "react-icons/fa";
import PayOSEmbed from "@/app/components/payment/PayOSEmbed";
import SessionImage from "@/app/components/common/SessionImage";
import KioskCameraPanel from "@/app/employee/checkin/components/KioskCameraPanel";
import GateStatusPanel from "@/app/employee/checkin/components/GateStatusPanel";
import { detectLicensePlate } from "@/app/api/employee.lpd.client";
import { fetchEmployeeGateSettings } from "@/app/api/admin.gateSettings.client";

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
    const embedElementId = `payos-embed-${sessionid}-${embedVersion}`;
    const isMountedRef = useRef(true);
    const checkoutCameraRef = useRef(null);

    // Gate state machine (matches kiosk check-in pattern)
    const [gateState, setGateState] = useState("shut");
    const gateTimerRef = useRef(null);
    const gateContextRef = useRef(null); // "checkout" | "manual" | "hold" | null

    // Configurable auto-close duration (fetched from server, fallback 4000ms)
    const [autoCloseDurationMs, setAutoCloseDurationMs] = useState(4000);

    // View state machine for checkout flow
    const [viewState, setViewState] = useState("input"); // "input" | "processing" | "success" | "payment_failed"
    const [successDetail, setSuccessDetail] = useState(null);

    // Exit-image plate detection for đối chiếu (visual + plate match against check-in)
    const [exitPlate, setExitPlate] = useState(null);
    const [detectingExitPlate, setDetectingExitPlate] = useState(false);

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
            })
            .catch((err) => {
                console.warn("Failed to fetch gate settings, using default 4000ms", err);
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

        // Req 1.2: capture exit image with 3s timeout; empty string if fails
        let imageOut = "";
        try {
            imageOut = await Promise.race([
                Promise.resolve(checkoutCameraRef.current?.capture() || ""),
                new Promise((_, reject) => setTimeout(() => reject(new Error("Camera timeout")), 3000)),
            ]);
        } catch {
            imageOut = "";
        }

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
    const handleDetectExitPlate = async () => {
        const imageBase64 = checkoutCameraRef.current?.capture();
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

                    // Capture the live exit frame and persist it. The PayOS webhook
                    // finalizes the session server-side and has no access to the
                    // operator's camera, so the browser uploads the image here to
                    // mirror the cash flow (otherwise image_out_url stays null).
                    const imageOut = checkoutCameraRef.current?.capture();
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

    if (loading) return <div className="p-8 text-center">Loading...</div>;
    if (error) return <div className="p-8 text-center text-red-600">{error}</div>;
    if (!checkout.session) return null;

    return (
        <main className="mx-auto max-w-6xl p-6 bg-white text-slate-800 rounded-2xl border border-gray-200 shadow-sm my-4">
            {/* Header */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-gray-150 pb-4 mb-6 gap-3">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
                        <h1 className="text-xl font-bold uppercase tracking-wider text-slate-900 font-mono">
                            Checkout Terminal
                        </h1>
                    </div>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">UNIFIED GATEWAY TERMINAL</p>
                </div>

                <div className="flex items-center gap-4 text-xs font-mono">
                    <div className="bg-gray-50 border border-gray-200 px-3 py-1.5 rounded flex items-center gap-2 text-slate-600 shadow-xs">
                        <span className="text-slate-400 uppercase tracking-widest text-[9px]">CLOCK:</span>
                        <span className="font-bold text-indigo-600 tracking-widest">
                            {currentTime.toLocaleTimeString()}
                        </span>
                    </div>
                </div>
            </header>

            {/* Main grid layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left pane: Camera, plates, images */}
                <div className="lg:col-span-7 space-y-6 flex flex-col">
                    {/* Exit Camera */}
                    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-pulse" />
                                <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-800 font-mono">
                                    Exit Camera Feed
                                </h2>
                            </div>
                            <span className="text-[10px] font-bold font-mono tracking-widest px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100 uppercase">
                                LIVE
                            </span>
                        </div>
                        <KioskCameraPanel ref={checkoutCameraRef} />
                        
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-2 border-t border-gray-100">
                            <p className="text-xs text-slate-500">Image will be captured automatically on checkout confirmation.</p>
                            <button
                                type="button"
                                onClick={handleDetectExitPlate}
                                disabled={detectingExitPlate}
                                className="w-full sm:w-auto px-3.5 py-2 cursor-pointer bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 active:scale-[0.97] transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-sm font-mono uppercase tracking-wider"
                            >
                                {detectingExitPlate ? (
                                    <>
                                        <FaSync className="animate-spin h-3.5 w-3.5" />
                                        Detecting...
                                    </>
                                ) : (
                                    <>
                                        <FaSync className="h-3.5 w-3.5" />
                                        Detect Plate
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Plate comparison details */}
                    {exitPlate && (() => {
                        const checkinPlate = checkout.session.license_plate || "";
                        const normalize = (p) => p.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
                        const isMatch = normalize(exitPlate) === normalize(checkinPlate);
                        return (
                            <div
                                className={`rounded-xl border p-5 shadow-sm transition-all duration-300 ${
                                    isMatch 
                                        ? "bg-emerald-50 border-emerald-200 text-emerald-850 shadow-[0_2px_8px_rgba(16,185,129,0.05)]" 
                                        : "bg-rose-50 border-rose-200 text-rose-850 shadow-[0_2px_8px_rgba(244,63,94,0.05)]"
                                }`}
                            >
                                <div className="flex items-center justify-between border-b border-gray-150 pb-3 mb-3">
                                    <div className="flex items-center gap-2">
                                        <svg className={`w-5 h-5 ${isMatch ? "text-emerald-500" : "text-rose-500"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-800">License Plate Comparison</h2>
                                    </div>
                                    <span className={`text-[10px] font-bold font-mono tracking-widest px-2 py-0.5 rounded border uppercase ${
                                        isMatch ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-rose-100 text-rose-700 border-rose-200"
                                    }`}>
                                        {isMatch ? "MATCH" : "MISMATCH"}
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                                    <div className="bg-white/80 p-3 rounded-lg border border-gray-200/50">
                                        <span className="text-slate-500 uppercase tracking-widest text-[9px] block mb-1">Check-in Plate</span>
                                        <span className="text-base font-bold text-slate-800">{checkinPlate || "N/A"}</span>
                                    </div>
                                    <div className="bg-white/80 p-3 rounded-lg border border-gray-200/50">
                                        <span className="text-slate-500 uppercase tracking-widest text-[9px] block mb-1">Detected Exit Plate</span>
                                        <span className="text-base font-bold text-slate-800">{exitPlate}</span>
                                    </div>
                                </div>
                                <p className={`mt-3 text-xs font-semibold ${isMatch ? "text-emerald-750" : "text-rose-750"}`}>
                                    {isMatch ? "✓ Plates match. Ready for checkout." : "✗ Plates do not match — please verify vehicle visually before confirming."}
                                </p>
                            </div>
                        );
                    })()}

                    {/* Session Images comparison (Visual Đối chiếu) */}
                    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
                        <div className="flex items-center gap-2">
                            <FaImage className="text-indigo-600" />
                            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-800 font-mono">
                                Visual Comparison Evidence
                            </h2>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <span className="text-slate-500 uppercase tracking-widest text-[9px] font-mono block">Check-in Image</span>
                                <div className="rounded-lg overflow-hidden border border-gray-100 bg-gray-50 flex items-center justify-center p-2 min-h-[160px]">
                                    <SessionImage
                                        objectKey={checkout.session.image_in_url}
                                        type="in"
                                        sessionId={sessionid}
                                    />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <span className="text-slate-500 uppercase tracking-widest text-[9px] font-mono block">Check-out Image</span>
                                <div className="rounded-lg overflow-hidden border border-gray-100 bg-gray-50 flex items-center justify-center p-2 min-h-[160px]">
                                    <SessionImage
                                        objectKey={checkout.session.image_out_url}
                                        type="out"
                                        sessionId={sessionid}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column (5/12 width) - Sidebar */}
                <div className="lg:col-span-5 space-y-6">
                    {/* Gate Status Panel (Req 3.7, 4.1, 4.8) */}
                    <GateStatusPanel
                        isOpen={gateState === "open"}
                        isHoldMode={gateContextRef.current === "hold"}
                        onManualOpen={handleManualGateOpen}
                        onHoldOpen={handleHoldOpen}
                        onManualClose={handleManualGateClose}
                    />

                    {/* Inline Success_View (Req 3.3, 3.6) */}
                    {viewState === "success" && successDetail && (
                        <div className="bg-green-50 border border-green-200 rounded-xl p-5 shadow-sm" data-testid="success-view">
                            <div className="flex items-center justify-center mb-4">
                                <div className="bg-green-100 rounded-full p-3">
                                    <FaCheckCircle className="h-8 w-8 text-green-600" />
                                </div>
                            </div>
                            <h3 className="text-lg font-semibold text-center text-green-800 mb-2">Payment Completed</h3>
                            <p className="text-center text-green-700 mb-5 text-sm">
                                The vehicle has been successfully checked out from the parking lot.
                            </p>
                            <div className="grid grid-cols-2 gap-x-6 gap-y-4 max-w-lg mx-auto text-sm">
                                <div>
                                    <p className="text-[10px] font-bold font-mono uppercase tracking-wider text-slate-500 mb-0.5">License Plate</p>
                                    <p className="font-semibold text-slate-800">{successDetail.license_plate}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold font-mono uppercase tracking-wider text-slate-500 mb-0.5">Duration</p>
                                    <p className="font-semibold text-slate-800">{successDetail.duration_hours} hours</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold font-mono uppercase tracking-wider text-slate-500 mb-0.5">Payment Amount</p>
                                    <p className="font-semibold text-slate-800">
                                        {formatCurrency(successDetail.amount)}
                                        {successDetail.is_monthly && " (Monthly Pass)"}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold font-mono uppercase tracking-wider text-slate-500 mb-0.5">Payment Method</p>
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
                    )}

                    {/* Lost Ticket Action Banner */}
                    <div className="flex items-center justify-between gap-3 p-4 bg-gray-50 border border-gray-200 rounded-xl">
                        <div className="flex items-center gap-2.5">
                            <FaExclamationTriangle className={`w-5 h-5 shrink-0 ${checkout.session?.is_lost ? 'text-red-500' : 'text-amber-500 animate-pulse'}`} />
                            <div>
                                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700 font-mono">Lost Ticket Status</h3>
                                <p className="text-[11px] text-slate-500 mt-0.5">
                                    {checkout.session?.is_lost ? "Lost ticket reported (penalty applied)" : "Report lost ticket if card is missing"}
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-2 shrink-0">
                            {checkout.session?.is_lost ? (
                                <button
                                    onClick={handleRemoveLostTicket}
                                    className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition-all cursor-pointer active:scale-[0.97] font-mono"
                                    disabled={loading}
                                >
                                    Remove Penalty
                                </button>
                            ) : (
                                <button
                                    onClick={handleLostTicketToggle}
                                    className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg border transition-all cursor-pointer active:scale-[0.97] font-mono ${
                                        showLostTicketForm
                                            ? "bg-amber-100 border-amber-400 text-amber-800"
                                            : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
                                    }`}
                                >
                                    {showLostTicketForm ? "Cancel" : "Report"}
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Lost Ticket Form */}
                    {showLostTicketForm && (
                        <form
                            className="bg-amber-50/50 border border-amber-200 rounded-xl p-5 shadow-sm space-y-4"
                            onSubmit={handleLostTicketSubmit}
                        >
                            <div className="flex items-center gap-2 text-amber-800 pb-2 border-b border-amber-150">
                                <FaIdCard className="text-amber-600" />
                                <span className="font-semibold text-xs uppercase tracking-wider font-mono">Lost Ticket Details</span>
                            </div>
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-[10px] font-bold font-mono uppercase tracking-wider text-slate-500 mb-1">Guest ID Card Photo</label>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleIdImageChange}
                                        className="block w-full text-xs text-slate-650 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 file:cursor-pointer"
                                    />
                                    {guestIdImage && (
                                        <span className="text-[10px] text-slate-400 font-mono mt-1 block">{guestIdImage.name}</span>
                                    )}
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
                            </div>
                            <div className="flex justify-end pt-2">
                                <button
                                    type="submit"
                                    disabled={reportingLost}
                                    className="px-4 py-2 cursor-pointer bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-semibold shadow-xs active:scale-[0.98] transition-all disabled:opacity-50 font-mono uppercase tracking-wider"
                                >
                                    {reportingLost ? "Reporting..." : "Apply Penalty"}
                                </button>
                            </div>
                        </form>
                    )}

                    {/* Session Summary Card */}
                    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm text-gray-600">
                        <div className="flex items-center gap-2 border-b border-gray-150 pb-3 mb-3">
                            <FaCar className="text-indigo-600" />
                            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-800">Session Information</h2>
                        </div>
                        <div className="bg-gray-50/80 rounded-lg p-4 font-mono text-xs border border-gray-200/80 space-y-2 relative shadow-inner">
                            <div className="flex justify-between items-center gap-4">
                                <span className="text-slate-500 uppercase tracking-widest text-[9px]">Ticket ID:</span>
                                <span className="font-bold text-slate-800">{checkout.session.session_id}</span>
                            </div>
                            <div className="flex justify-between items-center gap-4 border-t border-gray-200/60 pt-2">
                                <span className="text-slate-500 uppercase tracking-widest text-[9px]">License Plate:</span>
                                <span className="font-bold text-slate-800">{checkout.session.license_plate || "N/A"}</span>
                            </div>
                            <div className="flex justify-between items-center gap-4 border-t border-gray-200/60 pt-2">
                                <span className="text-slate-500 uppercase tracking-widest text-[9px]">Vehicle Type:</span>
                                <span className="font-bold text-slate-800 capitalize">{checkout.session.vehicle_type}</span>
                            </div>
                            <div className="flex justify-between items-center gap-4 border-t border-gray-200/60 pt-2">
                                <span className="text-slate-500 uppercase tracking-widest text-[9px]">Monthly Pass:</span>
                                <span className={`font-bold ${checkout.session.is_monthly ? 'text-emerald-600' : 'text-slate-650'}`}>
                                    {checkout.session.is_monthly ? "YES" : "NO"}
                                </span>
                            </div>
                            <div className="flex justify-between items-center gap-4 border-t border-gray-200/60 pt-2">
                                <span className="text-slate-500 uppercase tracking-widest text-[9px]">Lost Ticket Penalty:</span>
                                <span className={`font-bold ${isLostTicketApplied ? 'text-rose-600' : 'text-slate-650'}`}>
                                    {isLostTicketApplied ? "YES" : "NO"}
                                </span>
                            </div>
                        </div>
                    </section>

                    {/* Time & Billing Card */}
                    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm text-gray-600">
                        <div className="flex items-center gap-2 border-b border-gray-150 pb-3 mb-3">
                            <FaRegClock className="text-indigo-600" />
                            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-800">Time & Billing</h2>
                        </div>
                        <div className="bg-gray-50/80 rounded-lg p-4 font-mono text-xs border border-gray-200/80 space-y-2 relative shadow-inner mb-4">
                            <div className="flex justify-between items-center gap-4">
                                <span className="text-slate-500 uppercase tracking-widest text-[9px]">Check-In Time:</span>
                                <span className="font-medium text-slate-850">{formatDateTime(checkout.session.time_in)}</span>
                            </div>
                            <div className="flex justify-between items-center gap-4 border-t border-gray-200/60 pt-2">
                                <span className="text-slate-500 uppercase tracking-widest text-[9px]">Current Time:</span>
                                <span className="font-medium text-slate-850">{formatDateTime(currentTime)}</span>
                            </div>
                            <div className="flex justify-between items-center gap-4 border-t border-gray-200/60 pt-2">
                                <span className="text-slate-500 uppercase tracking-widest text-[9px]">Duration:</span>
                                <span className="font-bold text-slate-850">{liveHours ?? checkout.hours} hours</span>
                            </div>
                            <div className="flex justify-between items-center gap-4 border-t border-gray-200/60 pt-2">
                                <span className="text-slate-500 uppercase tracking-widest text-[9px]">Service Fee:</span>
                                <span className="font-medium text-slate-850">{formatCurrency(checkout.serviceFee)}</span>
                            </div>
                            <div className="flex justify-between items-center gap-4 border-t border-gray-200/60 pt-2">
                                <span className="text-slate-500 uppercase tracking-widest text-[9px]">Penalty Fee:</span>
                                <span className="font-medium text-rose-600">{formatCurrency(checkout.penaltyFee)}</span>
                            </div>
                        </div>

                        {/* Grand Total Highlight */}
                        <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4 flex items-center justify-between shadow-xs">
                            <div>
                                <span className="text-slate-500 font-mono uppercase tracking-widest text-[9px] block">Grand Total</span>
                                <span className="text-2xl font-black text-emerald-700 tracking-tight">{formatCurrency(getTotalAmount())}</span>
                            </div>
                            <div className="bg-emerald-100 text-emerald-800 p-2.5 rounded-lg">
                                <FaMoneyBillWave className="w-6 h-6" />
                            </div>
                        </div>
                    </section>

                    {/* Payment Method Card */}
                    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm text-gray-600">
                        <div className="flex items-center gap-2 border-b border-gray-150 pb-3 mb-3">
                            <FaRegCreditCard className="text-indigo-600" />
                            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-800">Payment Method</h2>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3 mb-4">
                            <div
                                className={`border rounded-xl p-3 flex items-center gap-3 cursor-pointer transition-all duration-200 active:scale-[0.97] ${
                                    paymentMethod === "CASH" 
                                        ? "bg-indigo-50/70 border-indigo-500 shadow-xs" 
                                        : "bg-white border-gray-200 hover:bg-gray-50"
                                }`}
                                onClick={() => setPaymentMethod("CASH")}
                            >
                                <div className={`p-1.5 rounded-lg ${paymentMethod === "CASH" ? "bg-indigo-100 text-indigo-700" : "bg-gray-50 text-gray-400"}`}>
                                    <FaMoneyBillWave className="h-5 w-5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <span className={`text-xs font-bold block ${paymentMethod === "CASH" ? "text-indigo-700" : "text-gray-700"}`}>
                                        Cash
                                    </span>
                                    <span className="text-[10px] text-slate-400 block truncate">Pay with physical cash</span>
                                </div>
                                <input
                                    type="radio"
                                    name="payment_method"
                                    value="CASH"
                                    checked={paymentMethod === "CASH"}
                                    onChange={() => setPaymentMethod("CASH")}
                                    className="accent-indigo-600 shrink-0"
                                />
                            </div>
                            <div
                                className={`border rounded-xl p-3 flex items-center gap-3 cursor-pointer transition-all duration-200 active:scale-[0.97] ${
                                    paymentMethod === "CARD" 
                                        ? "bg-indigo-50/70 border-indigo-500 shadow-xs" 
                                        : "bg-white border-gray-200 hover:bg-gray-50"
                                }`}
                                onClick={() => setPaymentMethod("CARD")}
                            >
                                <div className={`p-1.5 rounded-lg ${paymentMethod === "CARD" ? "bg-indigo-100 text-indigo-700" : "bg-gray-50 text-gray-400"}`}>
                                    <FaCreditCard className="h-5 w-5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <span className={`text-xs font-bold block ${paymentMethod === "CARD" ? "text-indigo-700" : "text-gray-700"}`}>
                                        Card
                                    </span>
                                    <span className="text-[10px] text-slate-400 block truncate">Pay online / scan QR</span>
                                </div>
                                <input
                                    type="radio"
                                    name="payment_method"
                                    value="CARD"
                                    checked={paymentMethod === "CARD"}
                                    onChange={() => setPaymentMethod("CARD")}
                                    className="accent-indigo-600 shrink-0"
                                />
                            </div>
                        </div>

                        {paymentMethod === "CARD" && (
                            <div className="mt-4 border border-gray-200 rounded-xl p-4 bg-white/50 space-y-3">
                                <div className="flex items-center justify-between border-b border-gray-150 pb-2">
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 font-mono">PayOS Embedded Checkout</h4>
                                    <button
                                        type="button"
                                        disabled={creatingIntent || cardStatus === "PAID" || regenerateCooldown > 0}
                                        onClick={async () => {
                                            await ensureCardIntent({ forceNew: true });
                                            setRegenerateCooldown(8);
                                        }}
                                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 disabled:text-gray-400 transition-colors"
                                    >
                                        {regenerateCooldown > 0
                                            ? `New QR (${regenerateCooldown}s)`
                                            : "New QR"}
                                    </button>
                                </div>

                                {creatingIntent && (
                                    <div className="flex items-center gap-2 py-4 justify-center text-xs text-slate-550 font-mono">
                                        <FaSync className="animate-spin text-indigo-600 h-3.5 w-3.5" />
                                        Generating payment QR...
                                    </div>
                                )}

                                {!creatingIntent && paymentIntent?.checkout_url && (
                                    <div className="rounded-lg overflow-hidden border border-gray-200 shadow-xs">
                                        <PayOSEmbed
                                            className="min-h-[60vh]"
                                            elementId={embedElementId}
                                            checkoutUrl={paymentIntent.checkout_url}
                                            returnUrl={typeof window !== "undefined" ? window.location.href : undefined}
                                            onError={(err) => {
                                                toast.error(err?.message || "Failed to load embedded checkout");
                                                setCardStatus("FAILED");
                                            }}
                                        />
                                    </div>
                                )}

                                {!creatingIntent && !paymentIntent?.checkout_url && (
                                    <p className="text-xs text-slate-500 font-mono text-center py-4">Waiting for checkout URL...</p>
                                )}

                                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs font-mono space-y-1.5">
                                    <div className="flex justify-between">
                                        <span className="text-slate-500 uppercase tracking-widest text-[9px]">Status:</span>
                                        <span className="font-bold text-slate-800">{cardStatus}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-500 uppercase tracking-widest text-[9px]">Message:</span>
                                        <span className="text-slate-650 text-right">{CARD_STATUS_LABELS[cardStatus] || "Waiting for update"}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </section>

                    {/* Bottom Action Footer — hidden during success (gate will auto-close & redirect) */}
                    {viewState !== "success" && (
                        <div className="flex gap-3 pt-2">
                            <button
                                onClick={() => router.replace("/employee/checkout")}
                                className="flex-1 px-4 py-3 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-xs font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer active:scale-[0.98]"
                            >
                                Cancel
                            </button>
                            {paymentMethod === "CASH" && (
                                <button
                                    onClick={handleCashCheckout}
                                    disabled={viewState === "processing" || viewState === "success" || (showLostTicketForm && !isLostTicket)}
                                    className="flex-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:border-transparent text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer active:scale-[0.98] flex items-center justify-center gap-1.5 shadow-sm"
                                >
                                    {viewState === "processing" ? (
                                        <>
                                            <FaSync className="animate-spin h-3.5 w-3.5" />
                                            Processing...
                                        </>
                                    ) : (
                                        <>
                                            <FaCheckCircle className="h-3.5 w-3.5" />
                                            Confirm Cash Checkout
                                        </>
                                    )}
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
}
