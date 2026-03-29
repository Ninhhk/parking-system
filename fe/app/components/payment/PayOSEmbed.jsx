"use client";

import { useEffect, useRef, useState } from "react";

const PAYOS_SCRIPT_ID = "payos-checkout-sdk";
const PAYOS_SCRIPT_URL = "https://cdn.payos.vn/payos-checkout/v1/stable/payos-initialize.js";

function ensurePayOSScript() {
    return new Promise((resolve, reject) => {
        if (window.PayOSCheckout) {
            resolve(window.PayOSCheckout);
            return;
        }

        const existing = document.getElementById(PAYOS_SCRIPT_ID);
        if (existing) {
            existing.addEventListener("load", () => resolve(window.PayOSCheckout), { once: true });
            existing.addEventListener("error", () => reject(new Error("Failed to load PayOS script")), { once: true });
            return;
        }

        const script = document.createElement("script");
        script.id = PAYOS_SCRIPT_ID;
        script.src = PAYOS_SCRIPT_URL;
        script.async = true;
        script.onload = () => resolve(window.PayOSCheckout);
        script.onerror = () => reject(new Error("Failed to load PayOS script"));
        document.body.appendChild(script);
    });
}

export default function PayOSEmbed({
    checkoutUrl,
    elementId,
    returnUrl,
    onReady,
    onSuccess,
    onExit,
    onError,
    className = "",
}) {
    const [loading, setLoading] = useState(false);
    const instanceRef = useRef(null);
    const onReadyRef = useRef(onReady);
    const onSuccessRef = useRef(onSuccess);
    const onExitRef = useRef(onExit);
    const onErrorRef = useRef(onError);

    useEffect(() => {
        onReadyRef.current = onReady;
        onSuccessRef.current = onSuccess;
        onExitRef.current = onExit;
        onErrorRef.current = onError;
    }, [onReady, onSuccess, onExit, onError]);

    useEffect(() => {
        let disposed = false;

        const mount = async () => {
            if (!checkoutUrl || !elementId) return;
            setLoading(true);
            try {
                const sdk = await ensurePayOSScript();
                if (disposed) return;
                const mountEl = document.getElementById(elementId);
                if (!mountEl) {
                    throw new Error(`PayOS mount element not found: ${elementId}`);
                }

                const config = {
                    RETURN_URL: returnUrl || window.location.href,
                    ELEMENT_ID: elementId,
                    CHECKOUT_URL: checkoutUrl,
                    embedded: true,
                    onSuccess: (event) => {
                        if (onSuccessRef.current) onSuccessRef.current(event);
                    },
                    onExit: (event) => {
                        if (onExitRef.current) onExitRef.current(event);
                    },
                };

                instanceRef.current = sdk.usePayOS(config);
                if (instanceRef.current?.open) {
                    instanceRef.current.open();
                }
                if (onReadyRef.current) onReadyRef.current();
            } catch (err) {
                if (!disposed && onErrorRef.current) onErrorRef.current(err);
            } finally {
                if (!disposed) setLoading(false);
            }
        };

        mount();

        return () => {
            disposed = true;
            if (instanceRef.current?.exit) {
                try {
                    const mountEl = document.getElementById(elementId);
                    if (mountEl) {
                        instanceRef.current.exit();
                    }
                } catch (e) {
                    // noop
                }
            }
            instanceRef.current = null;
        };
    }, [checkoutUrl, elementId, returnUrl]);

    return (
        <div className={`payos-embed-shell w-full border rounded-md bg-white overflow-hidden ${className}`}>
            {loading && <p className="text-sm text-gray-600 px-3 py-2">Loading embedded checkout...</p>}
            <div id={elementId} className="payos-embed-target" />
            <style jsx>{`
                .payos-embed-shell {
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                }

                .payos-embed-target {
                    width: 100%;
                    flex: 1 1 auto;
                    min-height: 620px;
                }

                @supports (min-height: 100dvh) {
                    .payos-embed-target {
                        min-height: 80dvh;
                    }
                }

                @media (min-width: 768px) {
                    .payos-embed-target {
                        min-height: 72vh;
                    }

                    @supports (min-height: 100dvh) {
                        .payos-embed-target {
                            min-height: 72dvh;
                        }
                    }
                }

                .payos-embed-target :global(iframe) {
                    display: block;
                    width: 100% !important;
                    height: 100% !important;
                    min-height: 100% !important;
                    border: 0;
                }
            `}</style>
        </div>
    );
}
