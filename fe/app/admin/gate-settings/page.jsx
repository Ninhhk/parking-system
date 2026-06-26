"use client";

import { useState, useEffect } from "react";
import { fetchGateSettings, updateGateSettings } from "@/app/api/admin.gateSettings.client";

const MIN_DURATION = 2;
const MAX_DURATION = 30;
const MIN_INPUT_RESET = 0;
const MAX_INPUT_RESET = 10;

export default function GateSettingsPage() {
    const [currentDuration, setCurrentDuration] = useState(null);
    const [durationInput, setDurationInput] = useState("");
    const [currentInputReset, setCurrentInputReset] = useState(null);
    const [inputResetInput, setInputResetInput] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [successMsg, setSuccessMsg] = useState("");
    const [errorMsg, setErrorMsg] = useState("");

    useEffect(() => {
        fetchGateSettings()
            .then((data) => {
                setCurrentDuration(data.auto_close_duration_seconds);
                setDurationInput(String(data.auto_close_duration_seconds));
                setCurrentInputReset(data.kiosk_input_reset_seconds);
                setInputResetInput(String(data.kiosk_input_reset_seconds));
            })
            .catch(() => {
                setCurrentDuration(4);
                setDurationInput("4");
                setCurrentInputReset(2);
                setInputResetInput("2");
            })
            .finally(() => setLoading(false));
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSuccessMsg("");
        setErrorMsg("");
        setSaving(true);

        try {
            const data = await updateGateSettings({
                auto_close_duration_seconds: Number(durationInput),
                kiosk_input_reset_seconds: Number(inputResetInput),
            });
            setCurrentDuration(data.auto_close_duration_seconds);
            setDurationInput(String(data.auto_close_duration_seconds));
            setCurrentInputReset(data.kiosk_input_reset_seconds);
            setInputResetInput(String(data.kiosk_input_reset_seconds));
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
            <h1 className="text-2xl font-bold text-slate-800">Gate Control Settings</h1>

            <section className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100">
                    <h2 className="text-lg font-semibold text-slate-800">Kiosk &amp; Gate Timings</h2>
                </div>
                <div className="p-6">
                    {loading ? (
                        <p className="text-slate-500 text-sm">Loading settings…</p>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div>
                                <div className="flex items-center gap-2 text-sm text-slate-600 mb-1">
                                    <span>Current value:</span>
                                    <span className="font-semibold text-slate-800">
                                        {currentDuration} seconds
                                    </span>
                                </div>
                                <label
                                    htmlFor="duration"
                                    className="block text-sm font-medium text-slate-700"
                                >
                                    Gate auto-close duration (seconds)
                                </label>
                                <input
                                    id="duration"
                                    type="number"
                                    min={MIN_DURATION}
                                    max={MAX_DURATION}
                                    step="1"
                                    value={durationInput}
                                    onChange={(e) => setDurationInput(e.target.value)}
                                    className="mt-1 block w-full max-w-xs border border-slate-200 rounded-md shadow-sm py-2 px-3 text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                                />
                                <p className="mt-1 text-xs text-slate-500">
                                    Valid range: {MIN_DURATION}–{MAX_DURATION} seconds
                                </p>
                            </div>

                            <div>
                                <div className="flex items-center gap-2 text-sm text-slate-600 mb-1">
                                    <span>Current value:</span>
                                    <span className="font-semibold text-slate-800">
                                        {currentInputReset} seconds
                                    </span>
                                </div>
                                <label
                                    htmlFor="input-reset"
                                    className="block text-sm font-medium text-slate-700"
                                >
                                    Kiosk input auto-clear delay (seconds)
                                </label>
                                <input
                                    id="input-reset"
                                    type="number"
                                    min={MIN_INPUT_RESET}
                                    max={MAX_INPUT_RESET}
                                    step="1"
                                    value={inputResetInput}
                                    onChange={(e) => setInputResetInput(e.target.value)}
                                    className="mt-1 block w-full max-w-xs border border-slate-200 rounded-md shadow-sm py-2 px-3 text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                                />
                                <p className="mt-1 text-xs text-slate-500">
                                    Grace period before the check-in/check-out RFID field clears
                                    and refocuses. Valid range: {MIN_INPUT_RESET}–{MAX_INPUT_RESET} seconds
                                    (0 = clear instantly).
                                </p>
                            </div>

                            {successMsg && (
                                <p className="text-green-600 text-sm">{successMsg}</p>
                            )}
                            {errorMsg && <p className="text-red-600 text-sm">{errorMsg}</p>}

                            <button
                                type="submit"
                                disabled={saving}
                                className="bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium"
                            >
                                {saving ? "Saving…" : "Save"}
                            </button>
                        </form>
                    )}
                </div>
            </section>
        </div>
    );
}
