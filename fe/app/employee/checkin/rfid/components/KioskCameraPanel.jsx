"use client";

import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from "react";

/**
 * Always-on camera panel for the RFID kiosk.
 * Exposes a `capture()` method via ref that returns a base64 JPEG string.
 */
const KioskCameraPanel = forwardRef(function KioskCameraPanel(_, ref) {
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
        <section className="rounded-lg border border-slate-200 bg-white overflow-hidden">
            <div className="bg-slate-800 text-white px-4 py-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold">Entry Camera</h2>
                <span
                    className={`inline-block w-2 h-2 rounded-full ${
                        status === "live" ? "bg-green-400 animate-pulse" : status === "connecting" ? "bg-yellow-400" : "bg-red-400"
                    }`}
                />
            </div>

            <div className="relative bg-black" style={{ aspectRatio: "16/9" }}>
                <video
                    ref={videoRef}
                    className="w-full h-full object-cover"
                    playsInline
                    muted
                    style={{ opacity: status === "live" ? 1 : 0 }}
                />

                {status === "connecting" && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-2 border-white border-t-transparent" />
                    </div>
                )}

                {status === "error" && (
                    <div className="absolute inset-0 flex items-center justify-center px-4">
                        <p className="text-red-300 text-sm text-center">{errorMsg}</p>
                    </div>
                )}
            </div>

            <canvas ref={canvasRef} className="hidden" />
        </section>
    );
});

export default KioskCameraPanel;
