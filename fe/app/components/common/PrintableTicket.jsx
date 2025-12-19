"use client";

import { FaQrcode, FaCar, FaMotorcycle, FaRegClock } from "react-icons/fa";

export default function PrintableTicket({ ticket, formatDateTime }) {
    if (!ticket) return null;
    
    return (
        <div id="printable-ticket" className="print-only">
            <div className="p-6">
                <div className="text-center mb-6">
                    <h2 className="text-2xl font-bold text-green-700">Parking Ticket</h2>
                    <p className="text-sm text-gray-500">Please keep this ticket safe</p>
                </div>
                
                <div className="space-y-4">
                    <div className="flex items-start">
                        <div className="bg-green-100 p-2 rounded-full mr-3">
                            <FaQrcode className="h-5 w-5 text-green-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Ticket ID</p>
                            <p className="font-semibold">{ticket.session_id}</p>
                        </div>
                    </div>

                    <div className="flex items-start">
                        <div className="bg-green-100 p-2 rounded-full mr-3">
                            <FaCar className="h-5 w-5 text-green-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">License Plate</p>
                            <p className="font-semibold">{ticket.license_plate}</p>
                        </div>
                    </div>

                    <div className="flex items-start">
                        <div className="bg-green-100 p-2 rounded-full mr-3">
                            {ticket.vehicle_type === "car" ? (
                                <FaCar className="h-5 w-5 text-green-600" />
                            ) : (
                                <FaMotorcycle className="h-5 w-5 text-green-600" />
                            )}
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Vehicle Type</p>
                            <p className="font-semibold capitalize">{ticket.vehicle_type}</p>
                        </div>
                    </div>

                    <div className="flex items-start">
                        <div className="bg-green-100 p-2 rounded-full mr-3">
                            <FaRegClock className="h-5 w-5 text-green-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Check-in Time</p>
                            <p className="font-semibold">{formatDateTime(ticket.time_in)}</p>
                        </div>
                    </div>
                </div>

                <div className="mt-6 pt-4 border-t border-gray-200 text-center text-sm text-gray-500">
                    <p>Please present this ticket when retrieving your vehicle.</p>
                    <p className="mt-1">Thank you for using our parking service!</p>
                </div>
            </div>
        </div>
    );
}
