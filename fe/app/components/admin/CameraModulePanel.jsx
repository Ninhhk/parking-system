"use client";

import { useState } from "react";

/**
 * Panel for managing processing modules assigned to a camera.
 * Shows toggle switches for each available module and a delete button.
 *
 * @param {Object} props
 * @param {Object|null} props.camera - Selected camera object (null if none selected)
 * @param {Array} props.modules - Module assignment objects for the selected camera
 * @param {Array} props.availableModules - Available module types (e.g., ["LPD"])
 * @param {Function} props.onToggleModule - async (cameraId, moduleType, enable) => boolean
 * @param {Function} props.onDeleteCamera - async (cameraId) => void
 */
export default function CameraModulePanel({
    camera,
    modules = [],
    availableModules = [],
    onToggleModule,
    onDeleteCamera,
}) {
    const [optimisticState, setOptimisticState] = useState({});
    const [toastMessage, setToastMessage] = useState(null);

    const showErrorToast = (message) => {
        setToastMessage(message);
        setTimeout(() => setToastMessage(null), 3000);
    };

    const isModuleEnabled = (moduleType) => {
        // Check optimistic state first
        if (optimisticState[moduleType] !== undefined) {
            return optimisticState[moduleType];
        }
        return modules.some(
            (m) => m.module_type === moduleType && m.is_enabled
        );
    };

    const handleToggle = async (moduleType) => {
        if (!camera) return;

        const currentState = isModuleEnabled(moduleType);
        const newState = !currentState;

        // Optimistic update
        setOptimisticState((prev) => ({ ...prev, [moduleType]: newState }));

        const success = await onToggleModule(camera.camera_id, moduleType, newState);

        if (!success) {
            // Revert on failure
            setOptimisticState((prev) => ({ ...prev, [moduleType]: currentState }));
            showErrorToast(`Failed to ${newState ? "enable" : "disable"} ${moduleType}`);
        } else {
            // Clear optimistic state on success (real data will reflect the change)
            setOptimisticState((prev) => {
                const next = { ...prev };
                delete next[moduleType];
                return next;
            });
        }
    };

    const handleDelete = () => {
        if (!camera) return;

        const confirmed = window.confirm(
            `Delete camera "${camera.camera_name}"? All module assignments will also be removed.`
        );
        if (confirmed) {
            onDeleteCamera(camera.camera_id);
        }
    };

    if (!camera) {
        return (
            <div className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                <h3 className="text-lg font-semibold text-gray-700 mb-2">Processing Modules</h3>
                <p className="text-sm text-gray-500">Select a camera to manage modules</p>
            </div>
        );
    }

    return (
        <div className="p-4 border border-gray-200 rounded-lg bg-white">
            <h3 className="text-lg font-semibold text-gray-700 mb-1">Processing Modules</h3>
            <p className="text-sm text-gray-500 mb-4">{camera.camera_name}</p>

            <div className="space-y-3">
                {availableModules.map((moduleType) => {
                    const enabled = isModuleEnabled(moduleType);
                    return (
                        <div
                            key={moduleType}
                            className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded"
                        >
                            <span className="text-sm font-medium text-gray-700">{moduleType}</span>
                            <button
                                type="button"
                                role="switch"
                                aria-checked={enabled}
                                aria-label={`Toggle ${moduleType}`}
                                onClick={() => handleToggle(moduleType)}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                    enabled ? "bg-indigo-600" : "bg-gray-300"
                                }`}
                            >
                                <span
                                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                        enabled ? "translate-x-6" : "translate-x-1"
                                    }`}
                                />
                            </button>
                        </div>
                    );
                })}
            </div>

            <div className="mt-6 pt-4 border-t border-gray-200">
                <button
                    type="button"
                    onClick={handleDelete}
                    className="w-full px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md"
                >
                    Delete Camera
                </button>
            </div>

            {toastMessage && (
                <div className="fixed bottom-4 right-4 bg-red-600 text-white px-4 py-2 rounded shadow-lg text-sm z-50">
                    {toastMessage}
                </div>
            )}
        </div>
    );
}
