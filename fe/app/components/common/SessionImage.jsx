"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import api from "@/app/api/client.config";

const MAX_RETRIES = 3;

/**
 * SessionImage Component
 *
 * Displays a parking session image (check-in or check-out) fetched via presigned URL.
 *
 * Props:
 * - objectKey: MinIO object key (null means no image stored)
 * - type: "in" | "out" — determines alt text and API direction param
 * - sessionId: parking session ID for fetching presigned URL
 */
export default function SessionImage({ objectKey, type, sessionId }) {
    const [state, setState] = useState("loading"); // loading | loaded | error | retrying | failed
    const [presignedUrl, setPresignedUrl] = useState(null);
    const retryCountRef = useRef(0);

    const altText = type === "in" ? "Check-in image" : "Check-out image";

    const fetchPresignedUrl = useCallback(async () => {
        try {
            const res = await api.get(`/sessions/${sessionId}/image-presigned`, {
                params: { direction: type },
            });
            const url = res.data?.data?.url;
            if (url) {
                setPresignedUrl(url);
                setState("loading");
            } else {
                throw new Error("No presigned URL returned");
            }
        } catch (err) {
            console.error("Failed to fetch presigned URL:", err);
            if (retryCountRef.current >= MAX_RETRIES) {
                setState("failed");
            } else {
                setState("error");
            }
        }
    }, [sessionId, type]);

    useEffect(() => {
        if (!objectKey) return;
        retryCountRef.current = 0;
        fetchPresignedUrl();
    }, [objectKey, fetchPresignedUrl]);

    const handleRetry = () => {
        retryCountRef.current += 1;
        if (retryCountRef.current >= MAX_RETRIES) {
            setState("failed");
        } else {
            setState("retrying");
            fetchPresignedUrl();
        }
    };

    const handleImageError = () => {
        retryCountRef.current += 1;
        if (retryCountRef.current >= MAX_RETRIES) {
            setState("failed");
        } else {
            setState("error");
        }
    };

    // No image stored
    if (!objectKey) {
        return (
            <div className="flex items-center justify-center h-32 bg-gray-50 border border-gray-200 rounded-lg">
                <p className="text-gray-500 text-sm">No image available</p>
            </div>
        );
    }

    // Permanent failure after max retries
    if (state === "failed") {
        return (
            <div className="flex items-center justify-center h-32 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-600 text-sm">Image could not be loaded</p>
            </div>
        );
    }

    // Error state with retry button
    if (state === "error") {
        return (
            <div className="flex flex-col items-center justify-center h-32 bg-yellow-50 border border-yellow-200 rounded-lg gap-2">
                <p className="text-yellow-700 text-sm">Failed to load image</p>
                <button
                    onClick={handleRetry}
                    className="px-3 py-1 text-sm bg-yellow-600 text-white rounded hover:bg-yellow-700 transition"
                >
                    Retry
                </button>
            </div>
        );
    }

    // Loading / retrying — show spinner until presigned URL is ready
    if ((state === "loading" || state === "retrying") && !presignedUrl) {
        return (
            <div className="flex items-center justify-center h-32 bg-gray-50 border border-gray-200 rounded-lg">
                <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-200 border-t-blue-600"></div>
            </div>
        );
    }

    // Image rendering (loading with URL, or loaded)
    return (
        <div className="relative">
            {(state === "loading" || state === "retrying") && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-50 rounded-lg">
                    <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-200 border-t-blue-600"></div>
                </div>
            )}
            <img
                src={presignedUrl}
                alt={altText}
                className="max-w-[480px] w-full h-auto rounded-lg"
                onLoad={() => setState("loaded")}
                onError={handleImageError}
            />
        </div>
    );
}
