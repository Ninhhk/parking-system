"use client";

import { useState, useEffect } from "react";
import { fetchCheckoutSettings, updateCheckoutSettings } from "@/app/api/admin.checkoutSettings.client";

const PAYMENT_METHODS = [
    { value: "CARD", label: "Card" },
    { value: "CASH", label: "Cash" },
];

export default function CheckoutSettingsPage() {
    const [currentValue, setCurrentValue] = useState(null);
    const [inputValue, setInputValue] = useState("CARD");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [successMsg, setSuccessMsg] = useState("");
    const [errorMsg, setErrorMsg] = useState("");

    useEffect(() => {
        fetchCheckoutSettings()
            .then((data) => {
                setCurrentValue(data.default_payment_method);
                setInputValue(data.default_payment_method);
            })
            .catch(() => {
                setCurrentValue("CARD");
                setInputValue("CARD");
            })
            .finally(() => setLoading(false));
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSuccessMsg("");
        setErrorMsg("");
        setSaving(true);

        try {
            const data = await updateCheckoutSettings(inputValue);
            setCurrentValue(data.default_payment_method);
            setInputValue(data.default_payment_method);
            setSuccessMsg("Checkout settings updated successfully.");
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

    const labelFor = (value) =>
        PAYMENT_METHODS.find((m) => m.value === value)?.label || value;

    return (
        <div className="container mx-auto p-6 space-y-8">
            <h1 className="text-2xl font-bold text-slate-800">Checkout Settings</h1>

            <section className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100">
                    <h2 className="text-lg font-semibold text-slate-800">Default Payment Method</h2>
                </div>
                <div className="p-6">
                    {loading ? (
                        <p className="text-slate-500 text-sm">Loading settings…</p>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 text-sm text-slate-600">
                                <span>Current value:</span>
                                <span className="font-semibold text-slate-800">
                                    {labelFor(currentValue)}
                                </span>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label
                                        htmlFor="default-payment-method"
                                        className="block text-sm font-medium text-slate-700"
                                    >
                                        Default payment method
                                    </label>
                                    <select
                                        id="default-payment-method"
                                        value={inputValue}
                                        onChange={(e) => setInputValue(e.target.value)}
                                        className="mt-1 block w-full max-w-xs border border-slate-200 rounded-md shadow-sm py-2 px-3 text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                                    >
                                        {PAYMENT_METHODS.map((m) => (
                                            <option key={m.value} value={m.value}>
                                                {m.label}
                                            </option>
                                        ))}
                                    </select>
                                    <p className="mt-1 text-xs text-slate-500">
                                        Pre-selected on the checkout screen. Operators can still
                                        change it per transaction.
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
                                    className="bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium"
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
