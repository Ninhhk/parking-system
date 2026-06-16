"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { findActiveSessionByCard } from "../../api/employee.client";
import { fetchEmployeeGateSettings } from "../../api/admin.gateSettings.client";
import { useToast } from "../../components/providers/ToastProvider";
import PageHeader from "../../components/common/PageHeader";
import ReaderPanel from "../checkin/components/ReaderPanel";
import { CFD_MSG, CFD_CHANNEL, useBroadcastChannel } from "./cfdChannel";
import { FaCarSide, FaQrcode } from "react-icons/fa";

export default function CheckOutPage() {
    const toast = useToast();
    const router = useRouter();
    const [cardUid, setCardUid] = useState("");
    const [resolving, setResolving] = useState(false);

    // Grace delay before the input clears + refocuses after a failed lookup
    // (admin-configurable via gate settings; fallback 2000ms).
    const [inputResetMs, setInputResetMs] = useState(2000);

    // Tell the customer display there's no active transaction (goes idle between cars).
    const postToCustomerDisplay = useBroadcastChannel(CFD_CHANNEL);
    useEffect(() => {
        postToCustomerDisplay({ type: CFD_MSG.STATE, payload: { idle: true } });
    }, [postToCustomerDisplay]);

    const openCustomerDisplay = () => {
        if (typeof window === "undefined") return;
        window.open("/employee/checkout/customer", "cfd", "width=720,height=1000");
    };

    useEffect(() => {
        fetchEmployeeGateSettings()
            .then((data) => {
                if (typeof data?.kiosk_input_reset_seconds === "number") {
                    setInputResetMs(data.kiosk_input_reset_seconds * 1000);
                }
            })
            .catch((err) => {
                console.warn("Failed to fetch kiosk input reset setting, using default 2000ms", err);
            });
    }, []);

    const handleCardTap = async (uid) => {
        if (resolving || !uid) return;
        setResolving(true);
        try {
            const { session_id } = await findActiveSessionByCard(uid);
            router.push(`/employee/checkout/${session_id}`);
        } catch (error) {
            const status = error.response?.status;
            const message =
                status === 404
                    ? "No active session found for this card"
                    : error.response?.data?.message || "Failed to look up session";
            toast.error(message);
            // Keep the failed UID visible briefly, then clear + refocus for the next scan.
            setTimeout(() => {
                setCardUid("");
                setResolving(false);
            }, inputResetMs);
        }
    };

    return (
        <div className="container mx-auto p-6">
            <div className="flex items-center justify-between gap-3">
                <PageHeader title="Check-Out Vehicle" />
                <button
                    type="button"
                    onClick={openCustomerDisplay}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-[10px] font-bold uppercase tracking-wider font-mono hover:bg-indigo-700 active:scale-[0.97] transition-all flex items-center gap-1.5 shrink-0"
                >
                    <FaQrcode className="h-3.5 w-3.5" /> Customer Display
                </button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
                {/* Card input */}
                <div>
                    <ReaderPanel
                        value={cardUid}
                        onChange={(e) => setCardUid(e.target.value)}
                        disabled={resolving}
                        onSubmit={() => handleCardTap(cardUid.trim())}
                    />
                </div>

                {/* Placeholder until a card resolves a session */}
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50/60 p-10 text-center">
                    <FaCarSide className="h-10 w-10 text-gray-300 mb-3" />
                    {resolving ? (
                        <p className="text-sm text-gray-600">Looking up active session...</p>
                    ) : (
                        <>
                            <p className="text-sm font-medium text-gray-600">
                                Tap or enter a card to begin checkout
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                                Session details and images will appear once the card is read
                            </p>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
