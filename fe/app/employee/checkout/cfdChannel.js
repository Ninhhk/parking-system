"use client";

import { useCallback, useEffect, useRef } from "react";

// Customer-Facing Display (CFD) sync over BroadcastChannel.
//
// The operator checkout screen broadcasts the current checkout/payment state;
// a read-only customer-display window (opened on a second monitor / mini-screen)
// renders it. Same-origin, same-machine only — no backend involvement.

export const CFD_MSG = {
    STATE: "state", // operator → customer: current checkout/payment state
    HELLO: "hello", // customer → operator: request a fresh state push on mount
};

// Single fixed channel for the kiosk: the customer display is opened once on the
// second monitor and follows whichever session the operator is currently on
// (mirrors a persistent POS customer-facing display, not a per-session window).
export const CFD_CHANNEL = "checkout-cfd";

// Thin hook around BroadcastChannel. Returns a stable post() function.
// `onMessage` receives the raw message data ({ type, payload }).
export function useBroadcastChannel(name, onMessage) {
    const channelRef = useRef(null);
    const handlerRef = useRef(onMessage);
    handlerRef.current = onMessage;

    useEffect(() => {
        if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") {
            return undefined;
        }
        const channel = new BroadcastChannel(name);
        channel.onmessage = (event) => handlerRef.current?.(event.data);
        channelRef.current = channel;
        return () => {
            channel.close();
            channelRef.current = null;
        };
    }, [name]);

    return useCallback((message) => {
        channelRef.current?.postMessage(message);
    }, []);
}
