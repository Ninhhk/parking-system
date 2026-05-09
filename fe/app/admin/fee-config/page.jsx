"use client";

import { useState, useEffect, useCallback } from "react";
import { getActiveFeeConfigs, getFeeConfigVersions, createFeeConfigVersion } from "../../api/admin.client";
import { useUser } from "../../components/providers/UserProvider";

// ─── helpers ────────────────────────────────────────────────────────────────

function formatDateTime(ts) {
    if (!ts) return "—";
    return new Date(ts).toLocaleString();
}

function emptyForm() {
    return {
        vehicle_type: "car",
        effective_from: "",
        rounding_strategy: "ceil_hour",
        grace_period_minutes: 0,
        hourly_rate: 0,
        daily_cap_enabled: false,
        daily_cap_amount: 0,
        tiered_rate_enabled: false,
        tiers: [{ up_to_hours: "", rate_per_hour: "" }],
        time_of_day_enabled: false,
        time_windows: [{ start_time: "", end_time: "", rate_multiplier: "" }],
        penalty_fee: 0,
    };
}

// ─── Active Config Panel ─────────────────────────────────────────────────────

function ActiveConfigPanel({ configs, loading }) {
    if (loading) {
        return <p className="text-gray-500 text-sm">Loading active configs…</p>;
    }
    if (!configs) return null;

    const vehicles = ["car", "bike"];

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {vehicles.map((vt) => {
                const cfg = configs[vt];
                if (!cfg) {
                    return (
                        <div key={vt} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                            <h3 className="font-semibold text-gray-700 capitalize mb-2">{vt}</h3>
                            <p className="text-gray-400 text-sm">No active config found.</p>
                        </div>
                    );
                }
                return (
                    <div key={vt} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                        <h3 className="font-semibold text-gray-700 capitalize mb-3">{vt}</h3>
                        <dl className="space-y-1 text-sm">
                            <ConfigRow label="Effective from" value={formatDateTime(cfg.effective_from)} />
                            <ConfigRow label="Rounding strategy" value={cfg.rounding_strategy} />
                            <ConfigRow label="Grace period" value={`${cfg.grace_period_minutes} min`} />
                            <ConfigRow label="Hourly rate" value={cfg.hourly_rate} />
                            <ConfigRow
                                label="Daily cap"
                                value={cfg.daily_cap_enabled ? `Enabled — ${cfg.daily_cap_amount}` : "Disabled"}
                            />
                            <ConfigRow
                                label="Tiered rate"
                                value={
                                    cfg.tiered_rate_enabled
                                        ? `Enabled — ${(cfg.tiers || []).length} bracket(s)`
                                        : "Disabled"
                                }
                            />
                            <ConfigRow
                                label="Time-of-day"
                                value={
                                    cfg.time_of_day_enabled
                                        ? `Enabled — ${(cfg.time_windows || []).length} window(s)`
                                        : "Disabled"
                                }
                            />
                            <ConfigRow label="Penalty fee" value={cfg.penalty_fee} />
                        </dl>
                    </div>
                );
            })}
        </div>
    );
}

function ConfigRow({ label, value }) {
    return (
        <div className="flex justify-between">
            <dt className="text-gray-500">{label}</dt>
            <dd className="text-gray-800 font-medium">{String(value)}</dd>
        </div>
    );
}

// ─── Config Editor Form ──────────────────────────────────────────────────────

function FieldError({ errors, field }) {
    const err = errors?.find((e) => e.field === field);
    if (!err) return null;
    return <p className="text-red-500 text-xs mt-1">{err.message}</p>;
}

function inputCls(errors, field) {
    const hasErr = errors?.some((e) => e.field === field);
    return `mt-1 block w-full border rounded-md shadow-sm py-2 px-3 text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
        hasErr ? "border-red-400" : "border-gray-300"
    }`;
}

function ConfigEditorForm({ onSaved }) {
    const [form, setForm] = useState(emptyForm());
    const [fieldErrors, setFieldErrors] = useState([]);
    const [saving, setSaving] = useState(false);
    const [successMsg, setSuccessMsg] = useState("");

    const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

    // ── tiers ──
    const addTier = () => {
        if (form.tiers.length >= 10) return;
        setForm((f) => ({ ...f, tiers: [...f.tiers, { up_to_hours: "", rate_per_hour: "" }] }));
    };
    const removeTier = (i) =>
        setForm((f) => ({ ...f, tiers: f.tiers.filter((_, idx) => idx !== i) }));
    const setTier = (i, key, value) =>
        setForm((f) => {
            const tiers = f.tiers.map((t, idx) => (idx === i ? { ...t, [key]: value } : t));
            return { ...f, tiers };
        });

    // ── time windows ──
    const addWindow = () => {
        if (form.time_windows.length >= 3) return;
        setForm((f) => ({
            ...f,
            time_windows: [...f.time_windows, { start_time: "", end_time: "", rate_multiplier: "" }],
        }));
    };
    const removeWindow = (i) =>
        setForm((f) => ({ ...f, time_windows: f.time_windows.filter((_, idx) => idx !== i) }));
    const setWindow = (i, key, value) =>
        setForm((f) => {
            const time_windows = f.time_windows.map((w, idx) => (idx === i ? { ...w, [key]: value } : w));
            return { ...f, time_windows };
        });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setFieldErrors([]);
        setSuccessMsg("");

        // Confirmation when effective_from is in the past
        if (form.effective_from) {
            const chosen = new Date(form.effective_from);
            if (chosen < new Date()) {
                const ok = window.confirm(
                    "The effective date is in the past. This will immediately affect all new sessions. Continue?"
                );
                if (!ok) return;
            }
        }

        // Build payload — coerce numeric strings
        const payload = {
            vehicle_type: form.vehicle_type,
            effective_from: form.effective_from,
            rounding_strategy: form.rounding_strategy,
            grace_period_minutes: Number(form.grace_period_minutes),
            hourly_rate: Number(form.hourly_rate),
            daily_cap_enabled: form.daily_cap_enabled,
            daily_cap_amount: Number(form.daily_cap_amount),
            tiered_rate_enabled: form.tiered_rate_enabled,
            tiers: form.tiers.map((t) => ({
                up_to_hours: t.up_to_hours === "" ? null : Number(t.up_to_hours),
                rate_per_hour: Number(t.rate_per_hour),
            })),
            time_of_day_enabled: form.time_of_day_enabled,
            time_windows: form.time_windows.map((w) => ({
                start_time: w.start_time,
                end_time: w.end_time,
                rate_multiplier: Number(w.rate_multiplier),
            })),
            penalty_fee: Number(form.penalty_fee),
        };

        setSaving(true);
        try {
            await createFeeConfigVersion(payload);
            setSuccessMsg("Config version saved successfully.");
            setForm(emptyForm());
            onSaved();
        } catch (err) {
            const data = err?.response?.data;
            if (data?.fields) {
                setFieldErrors(data.fields);
            } else {
                setFieldErrors([{ field: "_general", message: data?.message || "An error occurred." }]);
            }
        } finally {
            setSaving(false);
        }
    };

    const labelCls = "block text-sm font-medium text-gray-700";
    const toggleCls = "h-4 w-4 text-blue-600 border-gray-300 rounded";

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {/* General error */}
            {fieldErrors.some((e) => e.field === "_general") && (
                <p className="text-red-600 text-sm">
                    {fieldErrors.find((e) => e.field === "_general").message}
                </p>
            )}
            {successMsg && <p className="text-green-600 text-sm">{successMsg}</p>}

            {/* Vehicle type + effective_from */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label className={labelCls}>Vehicle type</label>
                    <select
                        value={form.vehicle_type}
                        onChange={(e) => set("vehicle_type", e.target.value)}
                        className={inputCls(fieldErrors, "vehicle_type")}
                    >
                        <option value="car">Car</option>
                        <option value="bike">Bike</option>
                    </select>
                    <FieldError errors={fieldErrors} field="vehicle_type" />
                </div>
                <div>
                    <label htmlFor="effective_from" className={labelCls}>Effective from</label>
                    <input
                        id="effective_from"
                        type="datetime-local"
                        value={form.effective_from}
                        onChange={(e) => set("effective_from", e.target.value)}
                        className={inputCls(fieldErrors, "effective_from")}
                        required
                    />
                    <FieldError errors={fieldErrors} field="effective_from" />
                </div>
            </div>

            {/* Rounding + grace period */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label className={labelCls}>Rounding strategy</label>
                    <select
                        value={form.rounding_strategy}
                        onChange={(e) => set("rounding_strategy", e.target.value)}
                        className={inputCls(fieldErrors, "rounding_strategy")}
                    >
                        <option value="ceil_hour">Ceil to hour</option>
                        <option value="ceil_half_hour">Ceil to half hour</option>
                        <option value="exact_minutes">Exact minutes</option>
                    </select>
                    <FieldError errors={fieldErrors} field="rounding_strategy" />
                </div>
                <div>
                    <label className={labelCls}>Grace period (minutes)</label>
                    <input
                        type="number"
                        min={0}
                        max={60}
                        value={form.grace_period_minutes}
                        onChange={(e) => set("grace_period_minutes", e.target.value)}
                        className={inputCls(fieldErrors, "grace_period_minutes")}
                    />
                    <FieldError errors={fieldErrors} field="grace_period_minutes" />
                </div>
            </div>

            {/* Hourly rate */}
            <div>
                <label className={labelCls}>Hourly rate</label>
                <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.hourly_rate}
                    onChange={(e) => set("hourly_rate", e.target.value)}
                    className={inputCls(fieldErrors, "hourly_rate")}
                />
                <FieldError errors={fieldErrors} field="hourly_rate" />
            </div>

            {/* Daily cap */}
            <div className="border border-gray-200 rounded-lg p-4">
                <label className="flex items-center gap-2 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={form.daily_cap_enabled}
                        onChange={(e) => set("daily_cap_enabled", e.target.checked)}
                        className={toggleCls}
                    />
                    <span className={labelCls}>Enable daily cap</span>
                </label>
                {form.daily_cap_enabled && (
                    <div className="mt-3">
                        <label className={labelCls}>Daily cap amount</label>
                        <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={form.daily_cap_amount}
                            onChange={(e) => set("daily_cap_amount", e.target.value)}
                            className={inputCls(fieldErrors, "daily_cap_amount")}
                        />
                        <FieldError errors={fieldErrors} field="daily_cap_amount" />
                    </div>
                )}
            </div>

            {/* Tiered rate */}
            <div className="border border-gray-200 rounded-lg p-4">
                <label className="flex items-center gap-2 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={form.tiered_rate_enabled}
                        onChange={(e) => set("tiered_rate_enabled", e.target.checked)}
                        className={toggleCls}
                    />
                    <span className={labelCls}>Enable tiered rate</span>
                </label>
                {form.tiered_rate_enabled && (
                    <div className="mt-3 space-y-2">
                        {form.tiers.map((tier, i) => (
                            <div key={i} className="flex items-center gap-2">
                                <div className="flex-1">
                                    <input
                                        type="number"
                                        min={0}
                                        step="0.5"
                                        placeholder="Up to hours (blank = unlimited)"
                                        value={tier.up_to_hours}
                                        onChange={(e) => setTier(i, "up_to_hours", e.target.value)}
                                        className={inputCls(fieldErrors, `tiers[${i}].up_to_hours`)}
                                    />
                                    <FieldError errors={fieldErrors} field={`tiers[${i}].up_to_hours`} />
                                </div>
                                <div className="flex-1">
                                    <input
                                        type="number"
                                        min={0}
                                        step="0.01"
                                        placeholder="Rate per hour"
                                        value={tier.rate_per_hour}
                                        onChange={(e) => setTier(i, "rate_per_hour", e.target.value)}
                                        className={inputCls(fieldErrors, `tiers[${i}].rate_per_hour`)}
                                    />
                                    <FieldError errors={fieldErrors} field={`tiers[${i}].rate_per_hour`} />
                                </div>
                                {form.tiers.length > 1 && (
                                    <button
                                        type="button"
                                        onClick={() => removeTier(i)}
                                        className="text-red-500 hover:text-red-700 text-sm px-2"
                                    >
                                        Remove
                                    </button>
                                )}
                            </div>
                        ))}
                        {form.tiers.length < 10 && (
                            <button
                                type="button"
                                onClick={addTier}
                                className="text-blue-600 hover:underline text-sm"
                            >
                                + Add bracket
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Time-of-day */}
            <div className="border border-gray-200 rounded-lg p-4">
                <label className="flex items-center gap-2 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={form.time_of_day_enabled}
                        onChange={(e) => set("time_of_day_enabled", e.target.checked)}
                        className={toggleCls}
                    />
                    <span className={labelCls}>Enable time-of-day rate</span>
                </label>
                {form.time_of_day_enabled && (
                    <div className="mt-3 space-y-2">
                        {form.time_windows.map((win, i) => (
                            <div key={i} className="flex items-center gap-2 flex-wrap">
                                <div>
                                    <input
                                        type="time"
                                        value={win.start_time}
                                        onChange={(e) => setWindow(i, "start_time", e.target.value)}
                                        className={inputCls(fieldErrors, `time_windows[${i}].start_time`)}
                                        placeholder="Start"
                                    />
                                    <FieldError errors={fieldErrors} field={`time_windows[${i}].start_time`} />
                                </div>
                                <div>
                                    <input
                                        type="time"
                                        value={win.end_time}
                                        onChange={(e) => setWindow(i, "end_time", e.target.value)}
                                        className={inputCls(fieldErrors, `time_windows[${i}].end_time`)}
                                        placeholder="End"
                                    />
                                    <FieldError errors={fieldErrors} field={`time_windows[${i}].end_time`} />
                                </div>
                                <div>
                                    <input
                                        type="number"
                                        min={0}
                                        step="0.01"
                                        placeholder="Multiplier"
                                        value={win.rate_multiplier}
                                        onChange={(e) => setWindow(i, "rate_multiplier", e.target.value)}
                                        className={inputCls(fieldErrors, `time_windows[${i}].rate_multiplier`)}
                                    />
                                    <FieldError errors={fieldErrors} field={`time_windows[${i}].rate_multiplier`} />
                                </div>
                                {form.time_windows.length > 1 && (
                                    <button
                                        type="button"
                                        onClick={() => removeWindow(i)}
                                        className="text-red-500 hover:text-red-700 text-sm px-2"
                                    >
                                        Remove
                                    </button>
                                )}
                            </div>
                        ))}
                        {form.time_windows.length < 3 && (
                            <button
                                type="button"
                                onClick={addWindow}
                                className="text-blue-600 hover:underline text-sm"
                            >
                                + Add window
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Penalty fee */}
            <div>
                <label className={labelCls}>Penalty fee</label>
                <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.penalty_fee}
                    onChange={(e) => set("penalty_fee", e.target.value)}
                    className={inputCls(fieldErrors, "penalty_fee")}
                />
                <FieldError errors={fieldErrors} field="penalty_fee" />
            </div>

            <button
                type="submit"
                disabled={saving}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
            >
                {saving ? "Saving…" : "Save config version"}
            </button>
        </form>
    );
}

// ─── Version History Table ───────────────────────────────────────────────────

function VersionHistoryTable({ vehicleType }) {
    const [versions, setVersions] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        getFeeConfigVersions(vehicleType)
            .then(setVersions)
            .catch(() => setVersions([]))
            .finally(() => setLoading(false));
    }, [vehicleType]);

    if (loading) return <p className="text-gray-500 text-sm">Loading history…</p>;
    if (!versions.length) return <p className="text-gray-400 text-sm">No versions found.</p>;

    return (
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                    <tr>
                        {["Effective from", "Created by", "Created at", "Hourly rate", "Rounding"].map((h) => (
                            <th
                                key={h}
                                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                            >
                                {h}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {versions.map((v) => (
                        <tr key={v.config_version_id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 whitespace-nowrap">{formatDateTime(v.effective_from)}</td>
                            <td className="px-4 py-3 whitespace-nowrap">{v.created_by ?? "—"}</td>
                            <td className="px-4 py-3 whitespace-nowrap">{formatDateTime(v.created_at)}</td>
                            <td className="px-4 py-3 whitespace-nowrap">{v.hourly_rate}</td>
                            <td className="px-4 py-3 whitespace-nowrap">{v.rounding_strategy}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function FeeConfigPage() {
    const { user } = useUser();

    if (user?.permissions?.can_edit_fees !== true) {
        return (
            <div className="container mx-auto p-6">
                <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
                    <p className="text-red-700 font-medium">
                        You do not have permission to access this page.
                    </p>
                </div>
            </div>
        );
    }

    return <FeeConfigContent />;
}

function FeeConfigContent() {
    const [activeConfigs, setActiveConfigs] = useState(null);
    const [activeLoading, setActiveLoading] = useState(true);
    const [historyVehicle, setHistoryVehicle] = useState("car");
    const [historyKey, setHistoryKey] = useState(0); // bump to re-fetch history

    const loadActiveConfigs = useCallback(() => {
        setActiveLoading(true);
        getActiveFeeConfigs()
            .then((data) => {
                // data is an object keyed by vehicle_type, or an array — normalise
                if (Array.isArray(data)) {
                    const map = {};
                    data.forEach((c) => { map[c.vehicle_type] = c; });
                    setActiveConfigs(map);
                } else {
                    setActiveConfigs(data);
                }
            })
            .catch(() => setActiveConfigs(null))
            .finally(() => setActiveLoading(false));
    }, []);

    useEffect(() => {
        loadActiveConfigs();
    }, [loadActiveConfigs]);

    const handleSaved = () => {
        loadActiveConfigs();
        setHistoryKey((k) => k + 1);
    };

    return (
        <div className="container mx-auto p-6 space-y-8">
            <h1 className="text-2xl font-bold text-gray-800">Pricing Engine Configuration</h1>

            {/* Section 1 — Active Config */}
            <section>
                <div className="bg-blue-600 text-white px-6 py-4 rounded-t-lg">
                    <h2 className="text-lg font-semibold">Active Configuration</h2>
                </div>
                <div className="bg-white border border-t-0 border-gray-200 rounded-b-lg p-6">
                    <ActiveConfigPanel configs={activeConfigs} loading={activeLoading} />
                </div>
            </section>

            {/* Section 2 — Config Editor */}
            <section>
                <div className="bg-blue-600 text-white px-6 py-4 rounded-t-lg">
                    <h2 className="text-lg font-semibold">Create New Config Version</h2>
                </div>
                <div className="bg-white border border-t-0 border-gray-200 rounded-b-lg p-6">
                    <ConfigEditorForm onSaved={handleSaved} />
                </div>
            </section>

            {/* Section 3 — Version History */}
            <section>
                <div className="bg-blue-600 text-white px-6 py-4 rounded-t-lg flex items-center justify-between">
                    <h2 className="text-lg font-semibold">Version History</h2>
                    <select
                        value={historyVehicle}
                        onChange={(e) => setHistoryVehicle(e.target.value)}
                        className="text-gray-800 text-sm rounded px-2 py-1"
                    >
                        <option value="car">Car</option>
                        <option value="bike">Bike</option>
                    </select>
                </div>
                <div className="bg-white border border-t-0 border-gray-200 rounded-b-lg p-6">
                    <VersionHistoryTable key={`${historyVehicle}-${historyKey}`} vehicleType={historyVehicle} />
                </div>
            </section>
        </div>
    );
}
