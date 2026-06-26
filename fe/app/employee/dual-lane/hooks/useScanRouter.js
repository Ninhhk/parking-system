"use client";

import { useEffect, useRef, useState, useCallback } from "react";

const INTER_KEYSTROKE_TIMEOUT_MS = 200;

/**
 * Hook that listens for document-level keystrokes from USB HID RFID readers,
 * buffers characters, and routes completed scans (terminated by Enter) to
 * entry or exit based on configured prefix.
 *
 * @param {Object} config
 * @param {string} config.entryPrefix - Prefix for entry reader (e.g. "I:")
 * @param {string} config.exitPrefix - Prefix for exit reader (e.g. "O:")
 * @param {boolean} config.enabled - Whether the listener is active
 * @returns {{ lastEntryScan: string|null, lastExitScan: string|null, resetEntry: function, resetExit: function, configError: string|null }}
 */
export function useScanRouter({ entryPrefix, exitPrefix, enabled = true }) {
    const [lastEntryScan, setLastEntryScan] = useState(null);
    const [lastExitScan, setLastExitScan] = useState(null);
    const [configError, setConfigError] = useState(null);

    const bufferRef = useRef("");
    const timeoutRef = useRef(null);

    // Validate config
    useEffect(() => {
        if (!entryPrefix || !exitPrefix) {
            setConfigError("Entry and exit prefixes must be configured");
            return;
        }
        if (entryPrefix === exitPrefix) {
            setConfigError("Entry and exit prefixes must be different");
            return;
        }
        setConfigError(null);
    }, [entryPrefix, exitPrefix]);

    const resetBuffer = useCallback(() => {
        bufferRef.current = "";
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
    }, []);

    const resetEntry = useCallback(() => setLastEntryScan(null), []);
    const resetExit = useCallback(() => setLastExitScan(null), []);

    useEffect(() => {
        // Don't attach if disabled or config error
        if (!enabled || configError) return;

        const handleKeyDown = (e) => {
            // Ignore if focus is on an input/textarea (let those handle their own input)
            const tag = e.target.tagName;
            if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

            // Reset timeout on each keystroke
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }

            if (e.key === "Enter") {
                const scan = bufferRef.current;
                bufferRef.current = "";
                timeoutRef.current = null;

                if (!scan) return;

                // Route by prefix
                if (scan.startsWith(entryPrefix)) {
                    const cardUid = scan.slice(entryPrefix.length);
                    if (cardUid) {
                        setLastEntryScan(cardUid);
                    }
                } else if (scan.startsWith(exitPrefix)) {
                    const cardUid = scan.slice(exitPrefix.length);
                    if (cardUid) {
                        setLastExitScan(cardUid);
                    }
                }
                // Unknown prefix → ignore silently
                return;
            }

            // Only buffer printable single characters
            if (e.key.length === 1) {
                bufferRef.current += e.key;

                // Set inter-keystroke timeout
                timeoutRef.current = setTimeout(() => {
                    bufferRef.current = "";
                    timeoutRef.current = null;
                }, INTER_KEYSTROKE_TIMEOUT_MS);
            }
        };

        document.addEventListener("keydown", handleKeyDown);

        return () => {
            document.removeEventListener("keydown", handleKeyDown);
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, [enabled, configError, entryPrefix, exitPrefix]);

    return { lastEntryScan, lastExitScan, resetEntry, resetExit, configError };
}
