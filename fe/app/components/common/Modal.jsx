"use client";

import { useState, useEffect } from "react";
import { IoMdClose } from "react-icons/io";
import { BiLoaderAlt } from "react-icons/bi";

/**
 * Reusable Modal component for create/update forms
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether the modal is open
 * @param {Function} props.onClose - Function to call when closing the modal
 * @param {string} props.title - Modal title
 * @param {string} props.mode - "create" or "update"
 * @param {string} props.error - Error message to display (optional)
 * @param {boolean} props.loading - Whether form is submitting (optional)
 * @param {Function} props.onSubmit - Form submission handler
 * @param {React.ReactNode} props.children - Form content
 * @param {string} props.submitText - Text for submit button (defaults based on mode)
 */
export default function Modal({
    isOpen,
    onClose,
    title,
    mode = "create",
    error,
    loading = false,
    onSubmit,
    children,
    submitText,
}) {
    // Handle escape key press
    useEffect(() => {
        function handleEscKey(e) {
            if (e.key === "Escape" && isOpen && !loading) {
                onClose();
            }
        }

        window.addEventListener("keydown", handleEscKey);
        return () => window.removeEventListener("keydown", handleEscKey);
    }, [isOpen, loading, onClose]);

    // Lock body scroll when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
        return () => {
            document.body.style.overflow = "";
        };
    }, [isOpen]);

    if (!isOpen) return null;

    const defaultSubmitText = mode === "create" ? "Create" : "Save Changes";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 z-10"
                style={{ backgroundColor: "rgba(0, 0, 0, 0.4)" }}
                onClick={loading ? undefined : onClose}
            />

            {/* Modal content */}
            <div
                className="bg-white z-20 rounded-md shadow-md w-full max-w-md mx-4 overflow-hidden relative"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                    <h2 className="text-lg font-bold text-gray-800">
                        {title || (mode === "create" ? "Create New Item" : "Edit Item")}
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={loading}
                        className="text-gray-400 hover:text-gray-700 focus:outline-none"
                    >
                        <IoMdClose size={20} />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={onSubmit}>
                    <div className="px-6 py-4">
                        {/* Error message */}
                        {error && <div className="mb-4 text-red-600 text-sm">{error}</div>}

                        {/* Form fields */}
                        <div className="space-y-4">{children}</div>
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end space-x-3">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={loading}
                            className="px-4 py-2 border border-gray-300 rounded text-gray-700 bg-white hover:bg-gray-100 hover:border-gray-400 focus:outline-none transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-4 py-2 border border-transparent rounded shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <span className="flex items-center">
                                    <BiLoaderAlt className="animate-spin -ml-1 mr-2 h-4 w-4" />
                                    Processing...
                                </span>
                            ) : (
                                submitText || defaultSubmitText
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
