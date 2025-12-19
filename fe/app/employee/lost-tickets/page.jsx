"use client";
import React, { useState } from "react";
import { reportLostTicket } from "@/app/api/employee.client";
import FormField from "@/app/components/common/FormField";

export default function EmployeeLostTicketPage() {
    const [form, setForm] = useState({ session_id: "", guest_identification: "", guest_phone: "" });
    const [penaltyFee, setPenaltyFee] = useState(null);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(null);
    const [error, setError] = useState(null);

    const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setSuccess(null);
        setError(null);
        setPenaltyFee(null);
        try {
            const json = await reportLostTicket(form);
            if (json.success) {
                setSuccess("Lost ticket reported.");
                setPenaltyFee(json.penalty_fee || (json.data && json.data.penalty_fee));
                setForm({ session_id: "", guest_identification: "", guest_phone: "" });
            } else {
                setError(json.message || "Failed to report lost ticket");
            }
        } catch (err) {
            const message = err.response?.data?.message || "Failed to report lost ticket";
            if (message === "A lost ticket report already exists for this session") {
                setError("This session already has a lost ticket report");
            } else if (message === "Session not found") {
                setError("Invalid session ID");
            } else {
                setError(message);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex justify-center items-center min-h-[60vh] bg-gray-50">
            <div className="bg-white shadow-md rounded-lg p-8 w-full max-w-md">
                <h2 className="text-2xl font-semibold mb-6 text-center">Report Lost Ticket</h2>
                <form onSubmit={handleSubmit} className="space-y-5">
                    <FormField
                        name="session_id"
                        label="Session ID"
                        value={form.session_id}
                        onChange={handleChange}
                        required
                        placeholder="Session ID"
                    />
                    <FormField
                        name="guest_identification"
                        label="Guest Name/ID"
                        value={form.guest_identification}
                        onChange={handleChange}
                        required
                        placeholder="Guest Name or ID"
                    />
                    <FormField
                        name="guest_phone"
                        label="Guest Phone"
                        value={form.guest_phone}
                        onChange={handleChange}
                        required
                        placeholder="Guest Phone"
                    />
                    <button
                        type="submit"
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded transition"
                        disabled={loading}
                    >
                        {loading ? "Reporting..." : "Report"}
                    </button>
                </form>
                {success && (
                    <div className="text-green-600 mt-6 text-center font-medium">
                        {success}
                        {penaltyFee !== null && (
                            <div className="text-blue-600 mt-2">
                                Penalty Fee: <span className="font-bold">{penaltyFee}</span>
                            </div>
                        )}
                    </div>
                )}
                {error && <div className="text-red-600 mt-6 text-center font-medium">{error}</div>}
            </div>
        </div>
    );
}
