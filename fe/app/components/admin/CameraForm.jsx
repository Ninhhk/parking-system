"use client";

import { useState, useEffect } from "react";
import FormField from "../common/FormField";

const DIRECTION_OPTIONS = [
    { value: "ENTRY", label: "Entry" },
    { value: "EXIT", label: "Exit" },
];

const PURPOSE_OPTIONS = [
    { value: "plate", label: "Plate" },
    { value: "overview", label: "Overview" },
];

/**
 * Camera form component for create/edit
 *
 * @param {Object} props
 * @param {Object|null} props.camera - Existing camera for edit mode, null for create
 * @param {Array} props.lanes - Available lane IDs for dropdown
 * @param {Function} props.onSubmit - Callback with form data
 * @param {Function} props.onCancel - Callback to close the form
 * @param {string} props.error - Error message from parent
 */
export default function CameraForm({ camera = null, lanes = [], onSubmit, onCancel, error }) {
    const isEditMode = !!camera;

    const [form, setForm] = useState({
        camera_name: "",
        lane_id: "",
        direction: "ENTRY",
        purpose: "plate",
        stream_url: "",
    });

    useEffect(() => {
        if (camera) {
            setForm({
                camera_name: camera.camera_name || "",
                lane_id: camera.lane_id || "",
                direction: camera.direction || "ENTRY",
                purpose: camera.purpose || "plate",
                stream_url: camera.stream_url || "",
            });
        }
    }, [camera]);

    const laneOptions = lanes.map((lane) => ({
        value: typeof lane === "object" ? lane.lane_id : lane,
        label: typeof lane === "object" ? lane.lane_id : lane,
    }));

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onSubmit(form);
    };

    return (
        <form onSubmit={handleSubmit}>
            {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
                    {error}
                </div>
            )}

            <FormField
                name="camera_name"
                label="Camera Name"
                value={form.camera_name}
                onChange={handleChange}
                required
            />

            <FormField
                name="lane_id"
                label="Lane"
                type="select"
                value={form.lane_id}
                onChange={handleChange}
                options={laneOptions}
                placeholder="Select a lane"
                required
            />

            <FormField
                name="direction"
                label="Direction"
                type="select"
                value={form.direction}
                onChange={handleChange}
                options={DIRECTION_OPTIONS}
                required
            />

            <FormField
                name="purpose"
                label="Purpose"
                type="select"
                value={form.purpose}
                onChange={handleChange}
                options={PURPOSE_OPTIONS}
                required
            />

            <FormField
                name="stream_url"
                label="Stream URL"
                value={form.stream_url}
                onChange={handleChange}
                placeholder="rtsp://... (optional)"
            />

            <div className="flex justify-end gap-3 mt-6">
                <button
                    type="button"
                    onClick={onCancel}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                >
                    {isEditMode ? "Update Camera" : "Create Camera"}
                </button>
            </div>
        </form>
    );
}
