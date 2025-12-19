"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import PageHeader from "../../../components/admin/PageHeader";
import { fetchParkingLotById, fetchLotParkingSessions } from "../../../api/admin.client";

async function fetchParkingLotData(id, setParkingLot, setError) {
    try {
        const lotData = await fetchParkingLotById(id);
        setParkingLot(lotData);
    } catch (err) {
        console.error("Error fetching parking lot details:", err);
        setError("Failed to load parking lot details. Please try again later.");
    }
}

async function fetchParkingSessions(id, setSessions, setError) {
    try {
        const sessionData = await fetchLotParkingSessions(id);
        setSessions(sessionData);
    } catch (err) {
        console.error("Error fetching parking sessions:", err);
        setError("Failed to load parking sessions. Please try again later.");
    }
}

export default function ParkingLotDetailPage() {
    const { id } = useParams();
    const [parkingLot, setParkingLot] = useState(null);
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        async function fetchData() {
            setLoading(true);
            setError(null); // Reset error state before fetching

            await Promise.all([
                fetchParkingLotData(id, setParkingLot, setError),
                fetchParkingSessions(id, setSessions, setError),
            ]);

            setLoading(false);
        }

        fetchData();
    }, [id]);

    if (loading) return <p className="text-center text-gray-500">Loading...</p>;
    if (error) return <p className="text-center text-red-500">{error}</p>;

    if (!parkingLot) {
        return <p className="text-center text-gray-500">Parking lot not found.</p>;
    }

    return (
        <div className="p-6 bg-gray-100 min-h-screen">
            
            <Link href="/admin/parking-lots">
                <button className="bg-blue-500 text-white px-4 py-2 rounded mb-4">Go Back</button>
            </Link>

            <PageHeader title={`Parking Lot: ${parkingLot.lot_name}`} onBack={() => window.history.back()} />

            <div className="bg-white shadow-md rounded-lg p-6 mb-6">
                <h2 className="text-lg font-semibold mb-4">Parking Lot Details</h2>
                <div className="grid grid-cols-2 gap-4">
                    <p><strong>Car Capacity:</strong> {parkingLot.car_capacity}</p>
                    <p><strong>Bike Capacity:</strong> {parkingLot.bike_capacity}</p>
                    <p><strong>Current Cars:</strong> {parkingLot.current_car}</p>
                    <p><strong>Current Bikes:</strong> {parkingLot.current_bike}</p>
                    <p><strong>Manager:</strong> {parkingLot.manager_username || "Unassigned"}</p>
                </div>
            </div>

            <div className="bg-white shadow-md rounded-lg p-6">
                <h2 className="text-lg font-semibold mb-4">Active Parking Sessions</h2>
                <table className="w-full border-collapse border border-gray-300 shadow-md rounded-lg overflow-hidden">
                    <thead>
                        <tr className="bg-blue-500 text-white">
                            <th className="border border-gray-300 px-4 py-2 text-left">Session ID</th>
                            <th className="border border-gray-300 px-4 py-2 text-left">Vehicle Type</th>
                            <th className="border border-gray-300 px-4 py-2 text-left">Plate Number</th>
                            <th className="border border-gray-300 px-4 py-2 text-left">Time In</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sessions.map((session, index) => (
                            <tr key={session.session_id} className={index % 2 === 0 ? "bg-gray-100" : "bg-white hover:bg-gray-200 transition-colors duration-200"}>
                                <td className="border border-gray-300 px-4 py-2">{session.session_id}</td>
                                <td className="border border-gray-300 px-4 py-2">{session.vehicle_type}</td>
                                <td className="border border-gray-300 px-4 py-2">{session.license_plate}</td>
                                <td className="border border-gray-300 px-4 py-2">{new Date(session.time_in).toLocaleString().slice(0,19)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}