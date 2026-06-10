"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { findActiveSessionByCard } from "../../api/employee.client";
import { useToast } from "../../components/providers/ToastProvider";
import PageHeader from "../../components/common/PageHeader";
import ReaderPanel from "../checkin/components/ReaderPanel";
import { FaCarSide } from "react-icons/fa";

export default function CheckOutPage() {
    const toast = useToast();
    const router = useRouter();
    const [cardUid, setCardUid] = useState("");
    const [resolving, setResolving] = useState(false);

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
            setResolving(false);
        }
    };

    return (
        <div className="container mx-auto p-6">
            <PageHeader title="Check-Out Vehicle" />
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
