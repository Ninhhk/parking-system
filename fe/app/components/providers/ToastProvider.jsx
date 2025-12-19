"use client";

import { createContext, useContext } from "react";
import { Toaster, toast } from "react-hot-toast";

// Create a context for more advanced toast functionality if needed
const ToastContext = createContext();

// Export the useToast hook
export function useToast() {
    return {
        success: (message) => toast.success(message),
        error: (message) => toast.error(message),
        warning: (message) => toast.custom((t) => (
            <div
                className={`${
                    t.visible ? 'animate-enter' : 'animate-leave'
                } max-w-md w-full bg-yellow-500 shadow-lg rounded-lg pointer-events-auto flex justify-between`}
            >
                <div className="p-3 text-white">{message}</div>
            </div>
        )),
        info: (message) => toast(message)
    };
}

export default function ToastProvider() {
    return (
        <Toaster
            position="top-right"
            toastOptions={{
                duration: 3000,
                style: {
                    background: "#363636",
                    color: "#fff",
                },
                success: {
                    duration: 3000,
                    style: {
                        background: "#22c55e",
                        color: "#fff",
                    },
                },
                error: {
                    duration: 4000,
                    style: {
                        background: "#ef4444",
                        color: "#fff",
                    },
                },
            }}
        />
    );
}
