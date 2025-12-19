"use client";

import { useState } from "react";
import { checkInVehicle } from "../../api/employee.client";
import { detectLicensePlate } from "../../api/employee.lpd.client";
import { useToast } from "../../components/providers/ToastProvider";
import PageHeader from "../../components/common/PageHeader";
import { FaCar, FaMotorcycle, FaQrcode, FaPrint, FaRegClock, FaCheckCircle } from "react-icons/fa";
import FormField from "../../components/common/FormField";
import PrintableTicket from "../../components/common/PrintableTicket";
import WebcamFeed from "../../components/common/WebcamFeed";

export default function CheckInPage() {
    const toast = useToast();
    const [loading, setLoading] = useState(false);
    const [detectingPlate, setDetectingPlate] = useState(false);
    const [ticket, setTicket] = useState(null);
    const [showCamera, setShowCamera] = useState(false);
    const [plateDetected, setPlateDetected] = useState(false);
    const [form, setForm] = useState({
        license_plate: "",
        vehicle_type: "car",
    });

    const handleChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const handleLPDCapture = async (base64Image) => {
        setDetectingPlate(true);

        try {
            const result = await detectLicensePlate(base64Image);

            // Auto-populate license plate field
            setForm({
                ...form,
                license_plate: result.normalized_plate,
            });

            setShowCamera(false);
            setPlateDetected(true);

            // Show success message
            toast.success(`License plate detected: ${result.normalized_plate}`);

            // Clear detection flag after 3 seconds
            setTimeout(() => setPlateDetected(false), 3000);
        } catch (error) {
            console.error("LPD error:", error);
            const errorMessage = error.message || "Failed to detect license plate";
            toast.error(errorMessage);
        } finally {
            setDetectingPlate(false);
        }
    };

    const handleLPDError = (errorMessage) => {
        toast.error(errorMessage);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setTicket(null);

        try {
            const response = await checkInVehicle({
                ...form,
            });

            if (response.success) {
                toast.success("Vehicle checked in successfully");
                setForm({
                    ...form,
                    license_plate: "",
                });
                setTicket(response.ticket);
            } else {
                toast.error(response.message || "Failed to check in vehicle");
            }
        } catch (error) {
            console.error("Check-in error:", error);
            const errorMessage = error.response?.data?.message || "Failed to check in vehicle";
            toast.error(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const formatDateTime = (dateStr) => {
        const date = new Date(dateStr);
        return date.toLocaleString();
    };

    return (
        <div className="container mx-auto p-6">
            <PageHeader title="Check-In Vehicle" />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    {/* Camera Feed Section */}
                    {showCamera && (
                        <div className="mb-6">
                            <WebcamFeed
                                onCapture={handleLPDCapture}
                                isLoading={detectingPlate}
                                onError={handleLPDError}
                            />
                        </div>
                    )}

                    <div className="bg-white shadow-md rounded-lg overflow-hidden">
                        <div className="bg-blue-600 text-white px-6 py-4">
                            <h2 className="text-xl font-semibold">Vehicle Information</h2>
                            <p className="text-blue-100 text-sm">Enter details to create a new parking ticket</p>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6">
                            <div className="space-y-6">
                                {/* License Plate Input Section */}
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="block text-gray-700 font-medium">License Plate *</label>
                                        {plateDetected && (
                                            <span className="flex items-center text-green-600 text-sm">
                                                <FaCheckCircle className="mr-1" /> Auto-detected
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex gap-2">
                                        <div className="flex-1">
                                            <FormField
                                                name="license_plate"
                                                type="text"
                                                value={form.license_plate}
                                                onChange={handleChange}
                                                required
                                                placeholder="e.g., 51G-39466"
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setShowCamera(!showCamera)}
                                            disabled={loading || detectingPlate}
                                            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors font-medium"
                                        >
                                            {showCamera ? "Close" : "Scan"}
                                        </button>
                                    </div>
                                    <p className="text-gray-500 text-sm mt-2">
                                        Click "Scan" to use camera for automatic plate detection
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-gray-700 font-medium mb-2">Vehicle Type *</label>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div
                                            className={`border-2 rounded-md p-4 flex items-center cursor-pointer ${
                                                form.vehicle_type === "car"
                                                    ? "bg-blue-50 border-blue-500"
                                                    : "hover:bg-gray-50"
                                            }`}
                                            onClick={() => setForm({ ...form, vehicle_type: "car" })}
                                        >
                                            <FaCar
                                                className={`mr-3 h-5 w-5 ${
                                                    form.vehicle_type === "car" ? "text-blue-500" : "text-gray-400"
                                                }`}
                                            />
                                            <div>
                                                <span
                                                    className={`font-medium ${
                                                        form.vehicle_type === "car" ? "text-blue-700" : "text-gray-700"
                                                    }`}
                                                >
                                                    Car
                                                </span>
                                            </div>
                                            <input
                                                type="radio"
                                                name="vehicle_type"
                                                value="car"
                                                checked={form.vehicle_type === "car"}
                                                onChange={handleChange}
                                                className="ml-auto"
                                            />
                                        </div>
                                        <div
                                            className={`border-2 rounded-md p-4 flex items-center cursor-pointer ${
                                                form.vehicle_type === "bike"
                                                    ? "bg-blue-50 border-blue-500"
                                                    : "hover:bg-gray-50"
                                            }`}
                                            onClick={() => setForm({ ...form, vehicle_type: "bike" })}
                                        >
                                            <FaMotorcycle
                                                className={`mr-3 h-5 w-5 ${
                                                    form.vehicle_type === "bike" ? "text-blue-500" : "text-gray-400"
                                                }`}
                                            />
                                            <div>
                                                <span
                                                    className={`font-medium ${
                                                        form.vehicle_type === "bike" ? "text-blue-700" : "text-gray-700"
                                                    }`}
                                                >
                                                    Motorcycle
                                                </span>
                                            </div>
                                            <input
                                                type="radio"
                                                name="vehicle_type"
                                                value="bike"
                                                checked={form.vehicle_type === "bike"}
                                                onChange={handleChange}
                                                className="ml-auto"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-8">
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full px-4 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
                                >
                                    {loading ? "Processing..." : "Check In Vehicle"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>

                <div className="lg:col-span-1">
                    <div className="bg-white shadow-md rounded-lg overflow-hidden h-full">
                        <div className="bg-blue-600 text-white px-6 py-4">
                            <h2 className="text-xl font-semibold">Instructions</h2>
                        </div>
                        <div className="p-6">
                            <div className="space-y-4">
                                <p className="text-gray-600">
                                    Enter the vehicle license plate and select the appropriate vehicle type to check in
                                    a vehicle.
                                </p>
                                <div className="border-t pt-4">
                                    <h3 className="font-medium text-gray-700 mb-2">Guidelines:</h3>
                                    <ul className="list-disc pl-5 space-y-1 text-gray-600">
                                        <li>Verify license plate matches the actual vehicle</li>
                                        <li>Ensure correct vehicle type is selected</li>
                                        <li>Print ticket for customer upon successful check-in</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {ticket && (
                <div className="mt-8 bg-white border border-green-200 rounded-lg overflow-hidden shadow-md">
                    <div className="bg-green-600 text-white px-6 py-4 flex justify-between items-center">
                        <div>
                            <h3 className="text-xl font-semibold">Parking Ticket Generated</h3>
                            <p className="text-green-100 text-sm">Ticket created successfully</p>
                        </div>
                        <button
                            onClick={() => window.print()}
                            className="flex items-center px-4 py-2 bg-white text-green-600 rounded-md hover:bg-green-50 focus:outline-none focus:ring-2 focus:ring-white"
                        >
                            <FaPrint className="mr-2" />
                            Print
                        </button>
                    </div>

                    <div className="p-6 no-print">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

                        <div className="mt-4 p-4 bg-green-50 rounded-md text-green-800 text-sm">
                            <p>
                                This ticket has been successfully created and the vehicle has been checked in. Please
                                provide the printed ticket to the customer.
                            </p>
                        </div>
                    </div>
                    
                    {/* Hidden printable ticket */}
                    <PrintableTicket ticket={ticket} formatDateTime={formatDateTime} />
                </div>
            )}
        </div>
    );
}
