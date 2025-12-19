"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { initiateCheckout, confirmCheckout, reportLostTicket, deleteLostTicket } from "@/app/api/employee.client";
import PageHeader from "@/app/components/common/PageHeader";
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
} from "react-icons/fa";

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
    const [paymentMethod, setPaymentMethod] = useState("CASH");
    const [liveHours, setLiveHours] = useState(null);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [showLostTicketForm, setShowLostTicketForm] = useState(false);
    const [guestIdImage, setGuestIdImage] = useState(null);
    const [guestPhone, setGuestPhone] = useState("");
    const [isLostTicket, setIsLostTicket] = useState(false);
    const [reportingLost, setReportingLost] = useState(false);

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

    const handleConfirmPayment = async () => {
        if (!checkout.session) {
            toast.error("No checkout session to confirm");
            return;
        }
        setLoading(true);
        try {
            const result = await confirmCheckout(sessionid, paymentMethod);
            setCheckout((prev) => ({
                ...prev,
                amount: result.amount,
                hours: result.hours,
                serviceFee: result.serviceFee,
                penaltyFee: result.penaltyFee,
            }));
            toast.success("Payment confirmed and vehicle checked out");
            // Redirect to success page with relevant info
            const params = new URLSearchParams({
                license_plate: checkout.session.license_plate,
                duration_hours: (liveHours ?? checkout.hours).toString(),
                amount: (result.amount ?? checkout.amount).toString(),
                is_monthly: checkout.session.is_monthly ? "true" : "false",
                payment_method: paymentMethod,
            });
            router.replace(`/employee/checkout/success?${params.toString()}`);
        } catch (err) {
            toast.error(err.response?.data?.message || "Failed to confirm payment");
        } finally {
            setLoading(false);
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

    const handleIdImageChange = (e) => {
        setGuestIdImage(e.target.files[0]);
    };

    const handleGuestPhoneChange = (e) => {
        setGuestPhone(e.target.value);
    };

    const getTotalAmount = () => {
        if (isLostTicket) {
            return (checkout.amount || 0) + (checkout.penaltyFee || 0);
        }
        return checkout.amount;
    };

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
        <div className="container mx-auto p-6">
            <PageHeader title="Payment Details" />
            <div className="flex justify-end mb-4">
                <button
                    className={`flex items-center px-4 py-2 rounded-md text-sm font-medium border transition ${
                        showLostTicketForm
                            ? "bg-yellow-100 border-yellow-500 text-yellow-800"
                            : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
                    }`}
                    onClick={handleLostTicketToggle}
                >
                    <FaExclamationTriangle className="mr-2" />
                    {showLostTicketForm ? "Cancel Lost Ticket Report" : "Report Lost Ticket"}
                </button>
                {checkout.session?.is_lost && (
                    <button
                        onClick={handleRemoveLostTicket}
                        className="ml-4 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                        disabled={loading}
                    >
                        Remove Lost Ticket
                    </button>
                )}
            </div>
            {showLostTicketForm && (
                <form
                    className="bg-yellow-50 border border-yellow-400 rounded-lg p-4 mb-6"
                    onSubmit={handleLostTicketSubmit}
                >
                    <div className="mb-2 flex items-center text-yellow-800">
                        <FaIdCard className="mr-2" />
                        <span className="font-semibold">Lost Ticket Report</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Guest ID Card Photo</label>
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleIdImageChange}
                                className="block w-full text-sm text-gray-700"
                            />
                            {guestIdImage && (
                                <span className="text-xs text-gray-500 mt-1 block">{guestIdImage.name}</span>
                            )}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Guest Phone</label>
                            <input
                                type="tel"
                                value={guestPhone}
                                onChange={handleGuestPhoneChange}
                                className="block w-full border border-gray-300 rounded-md p-2 text-gray-800 text-sm"
                                placeholder="Enter guest phone number"
                            />
                        </div>
                    </div>
                    <div className="flex justify-end mt-4">
                        <button
                            type="submit"
                            disabled={reportingLost}
                            className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 disabled:opacity-50"
                        >
                            {reportingLost ? "Reporting..." : "Submit Lost Ticket Report"}
                        </button>
                    </div>
                </form>
            )}
            <div className="bg-white shadow-md rounded-lg overflow-hidden mt-6">
                <div className="bg-blue-600 text-white px-6 py-4">
                    <h2 className="text-xl font-semibold flex items-center">
                        <FaRegCreditCard className="mr-2" />
                        Payment Details
                    </h2>
                    <p className="text-blue-100 text-sm">Confirm payment to complete checkout</p>
                </div>
                <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <div className="bg-gray-50 rounded-lg p-4">
                            <div className="mb-4">
                                <h3 className="text-lg font-medium text-gray-900 flex items-center">
                                    <FaCar className="mr-2 text-blue-500" />
                                    Vehicle Information
                                </h3>
                            </div>
                            <div className="space-y-3">
                                <div className="flex justify-between">
                                    <span className="text-sm text-gray-500">Ticket ID:</span>
                                    <span className="text-sm font-medium">{checkout.session.session_id}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-gray-500">License Plate:</span>
                                    <span className="text-sm font-medium">{checkout.session.license_plate}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-gray-500">Vehicle Type:</span>
                                    <span className="text-sm font-medium capitalize">
                                        {checkout.session.vehicle_type}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-gray-500">Monthly Pass:</span>
                                    <span
                                        className={`text-sm font-medium ${
                                            checkout.session.is_monthly ? "text-green-600" : ""
                                        }`}
                                    >
                                        {checkout.session.is_monthly ? "Yes" : "No"}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-gray-500">Lost Ticket:</span>
                                    <span
                                        className={`text-sm font-medium ${
                                            checkout.session.is_lost ? "text-red-600" : ""
                                        }`}
                                    >
                                        {checkout.session.is_lost ? "Yes (penalty applied)" : "No"}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-4">
                            <div className="mb-4">
                                <h3 className="text-lg font-medium text-gray-900 flex items-center">
                                    <FaRegClock className="mr-2 text-blue-500" />
                                    Time & Billing
                                </h3>
                            </div>
                            <div className="space-y-3">
                                <div className="flex justify-between">
                                    <span className="text-sm text-gray-500">Check-In Time:</span>
                                    <span className="text-sm font-medium">
                                        {formatDateTime(checkout.session.time_in)}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-gray-500">Current Time:</span>
                                    <span className="text-sm font-medium">{formatDateTime(currentTime)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-gray-500">Duration:</span>
                                    <span className="text-sm font-medium">{liveHours ?? checkout.hours} hours</span>
                                </div>
                                <div className="flex justify-between font-medium">
                                    <span className="text-sm text-gray-700">Payment Amount:</span>
                                    <span className="text-lg text-green-600 font-bold">
                                        {formatCurrency(getTotalAmount())}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-gray-500">Service Fee:</span>
                                    <span className="text-sm font-medium">{formatCurrency(checkout.serviceFee)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-gray-500">Penalty Fee:</span>
                                    <span className="text-sm font-medium">{formatCurrency(checkout.penaltyFee)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4 mb-6">
                        <div className="mb-4">
                            <h3 className="text-lg font-medium text-gray-900 flex items-center">
                                <FaMoneyBillWave className="mr-2 text-blue-500" />
                                Payment Method
                            </h3>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div
                                className={`border rounded-lg p-4 flex items-center cursor-pointer ${
                                    paymentMethod === "CASH" ? "bg-blue-50 border-blue-500" : "hover:bg-gray-100"
                                }`}
                                onClick={() => setPaymentMethod("CASH")}
                            >
                                <div className="mr-3 bg-blue-100 p-2 rounded-full">
                                    <FaMoneyBillWave
                                        className={`h-6 w-6 ${
                                            paymentMethod === "CASH" ? "text-blue-500" : "text-gray-400"
                                        }`}
                                    />
                                </div>
                                <div>
                                    <span
                                        className={`font-medium ${
                                            paymentMethod === "CASH" ? "text-blue-700" : "text-gray-700"
                                        }`}
                                    >
                                        Cash Payment
                                    </span>
                                    <p className="text-xs text-gray-500">Pay with physical cash</p>
                                </div>
                                <input
                                    type="radio"
                                    name="payment_method"
                                    value="CASH"
                                    checked={paymentMethod === "CASH"}
                                    onChange={() => setPaymentMethod("CASH")}
                                    className="ml-auto"
                                />
                            </div>
                            <div
                                className={`border rounded-lg p-4 flex items-center cursor-pointer ${
                                    paymentMethod === "CARD" ? "bg-blue-50 border-blue-500" : "hover:bg-gray-100"
                                }`}
                                onClick={() => setPaymentMethod("CARD")}
                            >
                                <div className="mr-3 bg-blue-100 p-2 rounded-full">
                                    <FaCreditCard
                                        className={`h-6 w-6 ${
                                            paymentMethod === "CARD" ? "text-blue-500" : "text-gray-400"
                                        }`}
                                    />
                                </div>
                                <div>
                                    <span
                                        className={`font-medium ${
                                            paymentMethod === "CARD" ? "text-blue-700" : "text-gray-700"
                                        }`}
                                    >
                                        Card Payment
                                    </span>
                                    <p className="text-xs text-gray-500">Pay with debit/credit card</p>
                                </div>
                                <input
                                    type="radio"
                                    name="payment_method"
                                    value="CARD"
                                    checked={paymentMethod === "CARD"}
                                    onChange={() => setPaymentMethod("CARD")}
                                    className="ml-auto"
                                />
                            </div>
                        </div>
                    </div>
                    <div className="flex justify-between">
                        <button
                            onClick={() => router.replace("/employee/checkout")}
                            className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleConfirmPayment}
                            disabled={loading || (showLostTicketForm && !isLostTicket)}
                            className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 flex items-center"
                        >
                            {loading ? (
                                <>
                                    <FaSync className="animate-spin mr-2 h-4 w-4" />
                                    Processing...
                                </>
                            ) : (
                                <>
                                    <FaCheckCircle className="mr-2 h-4 w-4" />
                                    Confirm Payment
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
