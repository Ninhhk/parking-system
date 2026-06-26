"use client";

import { useEffect, useState } from "react";
import { FaCheckCircle, FaMoneyBillWave, FaQrcode, FaCarSide } from "react-icons/fa";
import { CFD_MSG, CFD_CHANNEL, useBroadcastChannel } from "../cfdChannel";

function formatCurrency(amount) {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "VND",
        minimumFractionDigits: 0,
    }).format(amount || 0);
}

// Frames PayOS's compact embedded checkout UI (the `/embedded/` variant the
// official SDK uses), with a loading placeholder. A plain iframe avoids the
// SDK's lifecycle fragility inside a popup window; the operator screen polls
// for PAID, so the SDK's postMessage callbacks aren't needed here.
function PaymentFrame({ checkoutUrl }) {
    const [loaded, setLoaded] = useState(false);
    // Use the standalone hosted checkout page (`/web/{id}`). Unlike the SDK's
    // `/embedded/` variant — which is driven by the SDK's postMessage handshake and
    // rejects being framed directly from another window ("Thông tin truyền lên không
    // hợp lệ") — the standalone page is self-contained and frames cleanly (no
    // X-Frame-Options), so it works on a detached second-screen display.
    return (
        <div className="relative w-full rounded-xl overflow-hidden bg-white min-h-[640px]">
            {!loaded && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-slate-400">
                    <FaQrcode className="h-16 w-16 animate-pulse" />
                    <p>Loading payment QR…</p>
                </div>
            )}
            <iframe
                src={checkoutUrl}
                title="Payment QR"
                allow="clipboard-write"
                onLoad={() => setLoaded(true)}
                className="w-full border-0 min-h-[640px]"
            />
        </div>
    );
}

// Read-only customer-facing display. The operator opens this once on a second
// screen; it follows whichever session the operator is on via BroadcastChannel
// and never drives any backend action itself.
export default function CustomerDisplayPage() {
    const [state, setState] = useState(null);

    const post = useBroadcastChannel(CFD_CHANNEL, (msg) => {
        if (msg?.type === CFD_MSG.STATE) setState(msg.payload);
    });

    // Ask the operator window to push the current state once we're listening.
    useEffect(() => {
        post({ type: CFD_MSG.HELLO });
    }, [post]);

    const idle = !state || state.idle || !state.method;
    const paid = Boolean(state?.paid || state?.status === "PAID");
    const method = state?.method;

    return (
        <main className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-8 font-mono">
            {idle ? (
                <div className="flex flex-col items-center text-center gap-4 text-slate-500">
                    <FaCarSide className="h-20 w-20" />
                    <p className="text-xl">Waiting for the next vehicle…</p>
                </div>
            ) : paid ? (
                <div className="flex flex-col items-center text-center gap-6">
                    <FaCheckCircle className="h-28 w-28 text-emerald-400" />
                    <h1 className="text-4xl font-bold text-emerald-300">Payment Successful</h1>
                    <p className="text-2xl text-slate-200">{formatCurrency(state.amount)}</p>
                    <p className="text-slate-400 text-lg">Thank you. Please drive safely.</p>
                </div>
            ) : (
                <div className="w-full max-w-xl flex flex-col items-center gap-8">
                    <header className="text-center space-y-2">
                        <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Amount Due</p>
                        <p className="text-6xl font-black tracking-tight text-white">
                            {formatCurrency(state.amount)}
                        </p>
                        {state.plate && (
                            <p className="text-lg text-slate-300">
                                {state.plate}
                                {state.durationHours != null && (
                                    <span className="text-slate-500"> · {state.durationHours}h</span>
                                )}
                            </p>
                        )}
                    </header>

                    {method === "CARD" ? (
                        state.checkoutUrl ? (
                            <PaymentFrame key={state.checkoutUrl} checkoutUrl={state.checkoutUrl} />
                        ) : (
                            <div className="flex flex-col items-center gap-3 text-slate-400 py-10">
                                <FaQrcode className="h-16 w-16 animate-pulse" />
                                <p>Preparing payment QR…</p>
                            </div>
                        )
                    ) : (
                        <div className="flex flex-col items-center gap-4 text-center py-10">
                            <div className="bg-emerald-500/10 text-emerald-400 rounded-full p-6">
                                <FaMoneyBillWave className="h-16 w-16" />
                            </div>
                            <p className="text-2xl font-semibold text-slate-100">Please pay with cash</p>
                            <p className="text-slate-400">Hand the amount above to the attendant.</p>
                        </div>
                    )}
                </div>
            )}
        </main>
    );
}
