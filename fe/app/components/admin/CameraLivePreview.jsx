"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Live webcam preview for the camera detail panel.
 * Supports selecting between multiple connected webcams.
 *
 * @param {Object} props
 * @param {Object} props.camera - Selected camera object
 */
export default function CameraLivePreview({ camera }) {
    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const [devices, setDevices] = useState([]);
    const [selectedDeviceId, setSelectedDeviceId] = useState("");
    const [status, setStatus] = useState("idle"); // idle | connecting | live | error
    const [errorMsg, setErrorMsg] = useState("");

    // Enumerate video input devices on mount
    useEffect(() => {
        async function loadDevices() {
            try {
                // Request permission first (needed to get device labels)
                await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
                const allDevices = await navigator.mediaDevices.enumerateDevices();
                const videoDevices = allDevices.filter((d) => d.kind === "videoinput");
                setDevices(videoDevices);
                if (videoDevices.length > 0 && !selectedDeviceId) {
                    setSelectedDeviceId(videoDevices[0].deviceId);
                }
            } catch (err) {
                setErrorMsg("Cannot access camera devices");
                setStatus("error");
            }
        }
        loadDevices();
    }, []);

    // Start/restart stream when device selection changes
    useEffect(() => {
        if (!selectedDeviceId) return;

        let mounted = true;

        async function startStream() {
            // Stop previous stream
            if (streamRef.current) {
                streamRef.current.getTracks().forEach((t) => t.stop());
                streamRef.current = null;
            }

            setStatus("connecting");
            setErrorMsg("");

            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { deviceId: { exact: selectedDeviceId }, width: { ideal: 640 }, height: { ideal: 480 } },
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

        startStream();

        return () => {
            mounted = false;
            if (streamRef.current) {
                streamRef.current.getTracks().forEach((t) => t.stop());
                streamRef.current = null;
            }
        };
    }, [selectedDeviceId]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach((t) => t.stop());
            }
        };
    }, []);

    return (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gray-800 text-white px-4 py-3 flex items-center justify-between">
                <div>
                    <h4 className="text-sm font-semibold">Live Preview</h4>
                    <p className="text-xs text-gray-300">{camera.camera_name}</p>
                </div>
                <span
                    className={`inline-block w-2 h-2 rounded-full ${
                        status === "live" ? "bg-green-400 animate-pulse" : status === "connecting" ? "bg-yellow-400" : "bg-red-400"
                    }`}
                />
            </div>

            {/* Device selector */}
            {devices.length > 1 && (
                <div className="px-4 py-2 border-b border-gray-200 bg-gray-50">
                    <select
                        value={selectedDeviceId}
                        onChange={(e) => setSelectedDeviceId(e.target.value)}
                        className="w-full text-sm border border-gray-300 rounded px-2 py-1"
                    >
                        {devices.map((d, i) => (
                            <option key={d.deviceId} value={d.deviceId}>
                                {d.label || `Camera ${i + 1}`}
                            </option>
                        ))}
                    </select>
                </div>
            )}

            {/* Video feed */}
            <div className="relative bg-black" style={{ aspectRatio: "4/3" }}>
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

                {status === "idle" && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <p className="text-gray-400 text-sm">No feed</p>
                    </div>
                )}
            </div>
        </div>
    );
}
