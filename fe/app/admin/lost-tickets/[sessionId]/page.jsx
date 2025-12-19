"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { fetchLostTicketBySessionId } from "../../../api/admin.client";
import PageHeader from "../../../components/common/PageHeader";
import Link from "next/link";
import { HiArrowLeft } from "react-icons/hi";

export default function LostTicketDetailPage() {
    const { sessionId } = useParams();
    const [ticket, setTicket] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchTicket = async () => {
            try {
                setLoading(true);
                setError(null);
                const data = await fetchLostTicketBySessionId(sessionId);
                setTicket(data);
            } catch (err) {
                setError("Failed to fetch lost ticket details");
            } finally {
                setLoading(false);
            }
        };
        fetchTicket();
    }, [sessionId]);

    if (loading) {
        return (
            <div className="p-6">
                <div className="flex justify-center items-center min-h-[400px]">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-6">
                <div className="text-red-600 text-center">{error}</div>
            </div>
        );
    }

    if (!ticket) {
        return (
            <div className="p-6">
                <div className="text-center">Lost ticket not found</div>
            </div>
        );
    }

    return (
        <div className="p-6">
            <div className="mb-6">
                <Link href="/admin/lost-tickets" className="inline-flex items-center text-blue-600 hover:text-blue-800">
                    <HiArrowLeft className="mr-2" /> Back to Lost Tickets
                </Link>
            </div>

            <PageHeader title={`Lost Ticket Details - ${ticket.session_id}`} />

            <div className="mt-6 bg-white shadow rounded-lg overflow-hidden">
                <div className="p-6 grid grid-cols-2 gap-6">
                    <div>
                        <h3 className="text-sm font-medium text-gray-500">Session ID</h3>
                        <p className="mt-1 text-lg">{ticket.session_id}</p>
                    </div>
                    <div>
                        <h3 className="text-sm font-medium text-gray-500">License Plate</h3>
                        <p className="mt-1 text-lg">{ticket.license_plate}</p>
                    </div>
                    <div>
                        <h3 className="text-sm font-medium text-gray-500">Vehicle Type</h3>
                        <p className="mt-1 text-lg">{ticket.vehicle_type}</p>
                    </div>
                    <div>
                        <h3 className="text-sm font-medium text-gray-500">Lot ID</h3>
                        <p className="mt-1 text-lg">{ticket.lot_id}</p>
                    </div>
                    <div>
                        <h3 className="text-sm font-medium text-gray-500">Time In</h3>
                        <p className="mt-1 text-lg">{new Date(ticket.time_in).toLocaleString()}</p>
                    </div>
                    <div>
                        <h3 className="text-sm font-medium text-gray-500">Time Out</h3>
                        <p className="mt-1 text-lg">
                            {ticket.time_out ? new Date(ticket.time_out).toLocaleString() : "N/A"}
                        </p>
                    </div>
                    <div>
                        <h3 className="text-sm font-medium text-gray-500">Penalty Fee</h3>
                        <p className="mt-1 text-lg">{ticket.penalty_fee} VND</p>
                    </div>
                    <div>
                        <h3 className="text-sm font-medium text-gray-500">Guest Phone</h3>
                        <p className="mt-1 text-lg">{ticket.guest_phone}</p>
                    </div>
                    {ticket.guest_identification && (
                        <div className="col-span-2">
                            <h3 className="text-sm font-medium text-gray-500">Guest Identification</h3>
                            <div className="mt-2">
                                <img
                                    src={ticket.guest_identification}
                                    alt="Guest ID"
                                    className="max-h-48 rounded border"
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
