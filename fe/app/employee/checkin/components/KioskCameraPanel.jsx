"use client";

import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from "react";

/**
 * Always-on camera panel for the unified kiosk.
 * Exposes a `capture()` method via ref that returns a base64 JPEG string.
 */
const KioskCameraPanel = forwardRef(function KioskCameraPanel({ onReady } = {}, ref) {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const streamRef = useRef(null);
    const [status, setStatus] = useState("connecting"); // connecting | live | error
    const [errorMsg, setErrorMsg] = useState("");

    useEffect(() => {
        let mounted = true;

        async function start() {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "environment" },
                    audio: false,
                });

                if (!mounted) {
                    stream.getTracks().forEach((t) => t.stop());
                    return;
                }

                streamRef.current = stream;
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    await videoRef.current.play();
                }
                setStatus("live");
                if (typeof onReady === "function") {
                    onReady();
                }
            } catch (err) {
                if (mounted) {
                    setErrorMsg(err.name === "NotAllowedError" ? "Camera permission denied" : err.message);
                    setStatus("error");
                }
            }
        }

        start();

        return () => {
            mounted = false;
            if (streamRef.current) {
                streamRef.current.getTracks().forEach((t) => t.stop());
                streamRef.current = null;
            }
        };
    }, []);

    // Expose capture() to parent via ref
    useImperativeHandle(ref, () => ({
        capture() {
            if (!videoRef.current || !canvasRef.current || status !== "live") {
                return null;
            }
            const video = videoRef.current;
            const canvas = canvasRef.current;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
            return canvas.toDataURL("image/jpeg", 0.85);
        },
    }));

    return (
        <section className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
            <div className="bg-gray-50 border-b border-gray-200 text-gray-700 px-4 py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-indigo-650" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-700">Entry Camera Feed</h2>
                </div>
                <span
                    className={`inline-block w-2.5 h-2.5 rounded-full border border-white ${
                        status === "live" ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.4)]" : status === "connecting" ? "bg-amber-400" : "bg-rose-500"
                    }`}
                />
            </div>

            <div className="relative bg-slate-900" style={{ aspectRatio: "16/9" }}>
                <video
                    ref={videoRef}
                    className="w-full h-full object-cover"
                    playsInline
                    muted
                    style={{ opacity: status === "live" ? 1 : 0 }}
                />

                {/* Clean CCTV-style overlay */}
                {status === "live" && (
                    <div className="absolute inset-0 pointer-events-none p-3 flex flex-col justify-between text-[10px] font-mono text-white select-none">
                        <div className="flex justify-between items-start">
                            <div className="bg-slate-900/60 px-2 py-1 rounded backdrop-blur-xs flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                <span>CAM_LANE_01_IN</span>
                            </div>
                            <div className="bg-slate-900/60 px-2 py-1 rounded backdrop-blur-xs">
                                <span>1080P</span>
                            </div>
                        </div>
                    </div>
                )}

                {status === "connecting" && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                        <div className="animate-spin rounded-full h-6 w-6 border-2 border-indigo-500 border-t-transparent" />
                        <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">Loading camera stream...</span>
                    </div>
                )}

                {status === "error" && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center px-4 bg-slate-950/80 gap-1.5">
                        <svg className="w-8 h-8 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <p className="text-rose-350 font-mono text-xs text-center">{errorMsg || "Camera feed unavailable"}</p>
                    </div>
                )}
            </div>

            <canvas ref={canvasRef} className="hidden" />
        </section>
    );
});

export default KioskCameraPanel;
