"use client";

import { useState, useEffect } from "react";
import { fetchGateSettings, updateGateSettings } from "@/app/api/admin.gateSettings.client";

const MIN_DURATION = 2;
const MAX_DURATION = 30;

export default function GateSettingsPage() {
    const [currentValue, setCurrentValue] = useState(null);
    const [inputValue, setInputValue] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [successMsg, setSuccessMsg] = useState("");
    const [errorMsg, setErrorMsg] = useState("");

    useEffect(() => {
        fetchGateSettings()
            .then((data) => {
                setCurrentValue(data.auto_close_duration_seconds);
                setInputValue(String(data.auto_close_duration_seconds));
            })
            .catch(() => {
                setCurrentValue(4);
                setInputValue("4");
            })
            .finally(() => setLoading(false));
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSuccessMsg("");
        setErrorMsg("");
        setSaving(true);

        try {
            const value = Number(inputValue);
            const data = await updateGateSettings(value);
            setCurrentValue(data.auto_close_duration_seconds);
            setInputValue(String(data.auto_close_duration_seconds));
            setSuccessMsg("Gate settings updated successfully.");
        } catch (err) {
            const msg =
                err?.response?.data?.message ||
                err?.response?.data?.errors?.[0]?.message ||
                "An error occurred.";
            setErrorMsg(msg);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="container mx-auto p-6 space-y-8">
            <h1 className="text-2xl font-bold text-gray-800">Gate Control Settings</h1>

            <section>
                <div className="bg-blue-600 text-white px-6 py-4 rounded-t-lg">
                    <h2 className="text-lg font-semibold">Auto-Close Duration</h2>
                </div>
                <div className="bg-white border border-t-0 border-gray-200 rounded-b-lg p-6">
                    {loading ? (
                        <p className="text-gray-500 text-sm">Loading settings…</p>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                                <span>Current value:</span>
                                <span className="font-semibold text-gray-800">
                                    {currentValue} seconds
                                </span>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label
                                        htmlFor="duration"
                                        className="block text-sm font-medium text-gray-700"
                                    >
                                        Auto-close duration (seconds)
                                    </label>
                                    <input
                                        id="duration"
                                        type="number"
                                        min={MIN_DURATION}
                                        max={MAX_DURATION}
                                        step="1"
                                        value={inputValue}
                                        onChange={(e) => setInputValue(e.target.value)}
                                        className="mt-1 block w-full max-w-xs border border-gray-300 rounded-md shadow-sm py-2 px-3 text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                    />
                                    <p className="mt-1 text-xs text-gray-500">
                                        Valid range: {MIN_DURATION}–{MAX_DURATION} seconds
                                    </p>
                                </div>

                                {successMsg && (
                                    <p className="text-green-600 text-sm">{successMsg}</p>
                                )}
                                {errorMsg && (
                                    <p className="text-red-600 text-sm">{errorMsg}</p>
                                )}

                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
                                >
                                    {saving ? "Saving…" : "Save"}
                                </button>
                            </form>
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
}
