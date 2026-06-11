"use client";

import { useState, useEffect, useCallback } from "react";

/**
 * Custom hook that encapsulates the browser Fullscreen API.
 * @returns {{ isFullscreen: boolean, toggle: () => void, supported: boolean }}
 */
export function useFullscreen() {
    const [isFullscreen, setIsFullscreen] = useState(false);

    const supported =
        typeof document !== "undefined" && !!document.fullscreenEnabled;

    useEffect(() => {
        if (typeof document === "undefined") return;

        const handleChange = () => {
            setIsFullscreen(document.fullscreenElement !== null);
        };

        document.addEventListener("fullscreenchange", handleChange);
        return () => {
            document.removeEventListener("fullscreenchange", handleChange);
        };
    }, []);

    const toggle = useCallback(async () => {
        if (typeof document === "undefined") return;

        try {
            if (document.fullscreenElement !== null) {
                await document.exitFullscreen();
            } else {
                await document.documentElement.requestFullscreen();
            }
        } catch {
            // Fail silently on rejection (e.g., permission denied, unsupported)
        }
    }, []);

    return { isFullscreen, toggle, supported };
}
