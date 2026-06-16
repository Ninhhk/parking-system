"use client";

import { useEffect } from "react";

function getStatusBadge(session) {
    if (session.is_lost) {
        return <span className="inline-flex px-2.5 py-0.5 rounded-full text-[9px] font-bold font-mono tracking-wider uppercase bg-rose-50 text-rose-700 border border-rose-200">Lost Ticket</span>;
    }
    if (session.time_out) {
        return <span className="inline-flex px-2.5 py-0.5 rounded-full text-[9px] font-bold font-mono tracking-wider uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">Completed</span>;
    }
    return <span className="inline-flex px-2.5 py-0.5 rounded-full text-[9px] font-bold font-mono tracking-wider uppercase bg-amber-50 text-amber-700 border border-amber-200">Active</span>;
}

function formatDateTime(dateStr) {
    if (!dateStr) return "—";
    const date = new Date(dateStr);
    return date.toLocaleString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    });
}

function formatFee(fee) {
    if (fee == null) return "—";
    return Number(fee).toLocaleString("vi-VN") + " ₫";
}

function ImageDisplay({ url, alt, label }) {
    if (!url) {
        return (
            <div className="w-full h-44 bg-slate-50 border border-slate-200 rounded-lg flex flex-col items-center justify-center gap-1 font-mono">
                <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">No image available</span>
                <span className="text-[9px] text-slate-300 uppercase tracking-widest font-bold">N/A</span>
            </div>
        );
    }
    return (
        <div className="relative group rounded-lg overflow-hidden border border-slate-200 bg-slate-900 shadow-2xs">
            <img
                src={url}
                alt={alt}
                className="w-full h-44 object-cover transition-transform duration-300 group-hover:scale-102"
            />
            <div className="absolute top-2 left-2 bg-slate-900/70 backdrop-blur-xs text-[9px] font-bold font-mono text-white px-2 py-0.5 rounded uppercase tracking-wider">
                {label || alt}
            </div>
        </div>
    );
}

const SessionDetailModal = ({ session, onClose }) => {
    useEffect(() => {
        function handleEscKey(e) {
            if (e.key === "Escape") {
                onClose();
            }
        }
        window.addEventListener("keydown", handleEscKey);
        return () => window.removeEventListener("keydown", handleEscKey);
    }, [onClose]);

    useEffect(() => {
        if (session) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
        return () => {
            document.body.style.overflow = "";
        };
    }, [session]);

    if (!session) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop with blur */}
            <div
                className="absolute inset-0 z-10 bg-slate-900/60 backdrop-blur-xs transition-opacity duration-300"
                onClick={onClose}
            />

            {/* Modal content */}
            <div
                className="bg-white z-20 rounded-2xl border border-slate-200 shadow-2xl w-full max-w-xl mx-auto overflow-hidden relative max-h-[90vh] flex flex-col transition-all duration-300 scale-100"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-150 bg-slate-50/50">
                    <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-indigo-650 animate-pulse" />
                        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 font-mono">Session Details</h2>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="cursor-pointer text-slate-400 hover:text-slate-600 bg-transparent hover:bg-slate-100 p-1.5 rounded-lg transition-colors font-mono text-xs font-bold leading-none flex items-center justify-center w-7 h-7"
                        aria-label="Close"
                    >
                        ✕
                    </button>
                </div>

                {/* Body */}
                <div className="px-6 py-5 overflow-y-auto space-y-6 flex-1">
                    {/* Details grid */}
                    <div className="bg-slate-50/50 border border-slate-150 rounded-xl p-4 grid grid-cols-2 gap-x-6 gap-y-4">
                        <div className="border-r border-slate-150 pr-2">
                            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono mb-0.5">License Plate</span>
                            <p className="text-sm font-mono font-bold text-slate-800 uppercase">{session.license_plate || "—"}</p>
                        </div>
                        <div>
                            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono mb-0.5">Vehicle Type</span>
                            <p className="text-sm font-mono font-bold text-slate-800 capitalize">{session.vehicle_type || "—"}</p>
                        </div>

                        <div className="col-span-2 border-t border-slate-150 pt-3 grid grid-cols-2 gap-x-6">
                            <div className="border-r border-slate-150 pr-2">
                                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono mb-0.5">Session ID</span>
                                <p className="text-xs font-mono font-semibold text-slate-700">#{session.session_id}</p>
                            </div>
                            <div>
                                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono mb-0.5">Card ID</span>
                                <p className="text-xs font-mono font-semibold text-slate-700 uppercase">{session.card_uid || "—"}</p>
                            </div>
                        </div>

                        <div className="col-span-2 border-t border-slate-150 pt-3">
                            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono mb-0.5">Pass Type</span>
                            <p className="text-xs font-mono font-semibold text-slate-700">{session.is_monthly ? "Monthly" : "Casual"}</p>
                        </div>
                        
                        <div className="col-span-2 border-t border-slate-150 pt-3 grid grid-cols-2 gap-x-6">
                            <div className="border-r border-slate-150 pr-2">
                                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono mb-0.5">Parking Lot</span>
                                <p className="text-xs font-mono font-semibold text-slate-700">{session.lot_name || "—"}</p>
                            </div>
                            <div>
                                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono mb-0.5">Session Status</span>
                                <div className="mt-1">{getStatusBadge(session)}</div>
                            </div>
                        </div>

                        <div className="col-span-2 border-t border-slate-150 pt-3 grid grid-cols-2 gap-x-6">
                            <div className="border-r border-slate-150 pr-2">
                                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono mb-0.5">Time In</span>
                                <p className="text-xs font-mono text-slate-650 font-medium">{formatDateTime(session.time_in)}</p>
                            </div>
                            <div>
                                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono mb-0.5">Time Out</span>
                                <p className="text-xs font-mono text-slate-650 font-medium">{formatDateTime(session.time_out)}</p>
                            </div>
                        </div>

                        <div className="col-span-2 border-t border-slate-150 pt-3">
                            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono mb-0.5">Calculated Parking Fee</span>
                            <p className="text-base font-mono font-bold text-indigo-700">{formatFee(session.parking_fee)}</p>
                        </div>
                    </div>

                    {/* Images */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono">Entry Camera Capture</span>
                            <ImageDisplay url={session.image_in_url} alt="Entry" label="ENTRY CAMERA" />
                        </div>
                        <div className="space-y-1.5">
                            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono">Exit Camera Capture</span>
                            <ImageDisplay url={session.image_out_url} alt="Exit" label="EXIT CAMERA" />
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-150 bg-slate-50/50 flex justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        className="cursor-pointer bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-5 py-2 text-xs font-bold font-mono tracking-wider uppercase rounded-lg transition-all shadow-2xs hover:shadow-xs"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SessionDetailModal;
