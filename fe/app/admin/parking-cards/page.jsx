"use client";

import { useState } from "react";
import PageHeader from "../../components/admin/PageHeader";
import Modal from "../../components/common/Modal";
import ParkingCardForm from "../../components/admin/ParkingCardForm";
import { useParkingCards } from "../../components/admin/hooks/useParkingCards";

export default function ParkingCardsPage() {
    const {
        cards,
        inventory,
        loading,
        error,
        form,
        formLoading,
        showForm,
        searchQuery,
        lotOptions,
        setShowForm,
        handleChange,
        handleSearchChange,
        handleSubmit,
        handleDelete,
        handleToggleMonthly,
    } = useParkingCards();

    // Track which card is being edited for monthly end date
    const [editingMonthly, setEditingMonthly] = useState(null); // card_uid
    const [monthlyEndDate, setMonthlyEndDate] = useState("");

    const getMonthlyLabel = (card) => {
        if (!card.is_monthly) return null;
        if (!card.monthly_end_date) return "No expiry";
        const endDate = new Date(card.monthly_end_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return endDate >= today ? "Active" : "Expired";
    };

    const handleMonthlyToggle = (card) => {
        if (card.is_monthly) {
            // Disabling — no date needed
            handleToggleMonthly(card, null);
        } else {
            // Enabling — show date picker
            setEditingMonthly(card.card_uid);
            // Default to 30 days from now
            const defaultEnd = new Date();
            defaultEnd.setDate(defaultEnd.getDate() + 30);
            setMonthlyEndDate(defaultEnd.toISOString().slice(0, 10));
        }
    };

    const confirmEnableMonthly = (card) => {
        if (!monthlyEndDate) return;
        handleToggleMonthly(card, monthlyEndDate);
        setEditingMonthly(null);
        setMonthlyEndDate("");
    };

    return (
        <>
            <PageHeader title="Card Pool" buttonText="+ Add Card" onButtonClick={() => setShowForm(true)} />

            {/* Inventory counts */}
            <div className="mb-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
                    <p className="text-sm text-gray-500">Total</p>
                    <p className="text-2xl font-bold text-gray-900">{inventory.total}</p>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
                    <p className="text-sm text-gray-500">Available</p>
                    <p className="text-2xl font-bold text-green-600">{inventory.available}</p>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
                    <p className="text-sm text-gray-500">Lost</p>
                    <p className="text-2xl font-bold text-red-600">{inventory.lost}</p>
                </div>
            </div>

            {/* Search Bar */}
            <div className="mb-4 flex">
                <div className="relative w-80">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                        <svg className="w-4 h-4 text-gray-500" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 20">
                            <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m19 19-4-4m0-7A7 7 0 1 1 1 8a7 7 0 0 1 14 0Z"/>
                        </svg>
                    </div>
                    <input
                        type="text"
                        id="parking-card-search"
                        className="block w-full p-3 pl-10 text-sm text-gray-900 border border-gray-300 rounded-lg bg-white focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Search by Card UID or lot..."
                        value={searchQuery}
                        onChange={handleSearchChange}
                    />
                </div>
            </div>

            {/* Card table with inline monthly toggle */}
            <div className="bg-white shadow-md rounded-lg overflow-hidden border border-gray-200">
                <div className="bg-blue-600 text-white px-6 py-4 flex justify-between items-center">
                    <h2 className="text-xl font-semibold">Cards</h2>
                    <span className="bg-white text-blue-600 rounded-full px-3 py-1 text-sm font-semibold">
                        {cards.length} items
                    </span>
                </div>
                <div className="overflow-x-auto">
                    {loading ? (
                        <div className="text-center py-8">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                            <p className="text-gray-600">Loading...</p>
                        </div>
                    ) : (
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Card UID</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Lot</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Monthly</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expires</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {cards.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-4 py-6 text-center text-sm text-gray-500">
                                            No cards found
                                        </td>
                                    </tr>
                                ) : (
                                    cards.map((card) => {
                                        const monthlyLabel = getMonthlyLabel(card);
                                        const isEditing = editingMonthly === card.card_uid;
                                        return (
                                            <tr key={card.card_uid} className="hover:bg-gray-50">
                                                <td className="px-4 py-3 text-sm font-mono text-gray-900">{card.card_uid}</td>
                                                <td className="px-4 py-3 text-sm text-gray-600">
                                                    {card.lot_id === null ? "Shared" : card.lot_name}
                                                </td>
                                                <td className="px-4 py-3 text-sm">
                                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                                        card.status === "available"
                                                            ? "bg-green-100 text-green-700"
                                                            : "bg-red-100 text-red-700"
                                                    }`}>
                                                        {card.status}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-sm">
                                                    {isEditing ? (
                                                        <div className="flex items-center gap-2">
                                                            <input
                                                                type="date"
                                                                value={monthlyEndDate}
                                                                onChange={(e) => setMonthlyEndDate(e.target.value)}
                                                                className="border border-gray-300 rounded px-2 py-1 text-xs"
                                                            />
                                                            <button
                                                                onClick={() => confirmEnableMonthly(card)}
                                                                className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                                                            >
                                                                ✓
                                                            </button>
                                                            <button
                                                                onClick={() => setEditingMonthly(null)}
                                                                className="px-2 py-1 text-xs bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                                                            >
                                                                ✕
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={() => handleMonthlyToggle(card)}
                                                            className={`px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer transition-colors ${
                                                                card.is_monthly
                                                                    ? monthlyLabel === "Active"
                                                                        ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                                                                        : "bg-amber-100 text-amber-700 hover:bg-amber-200"
                                                                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                                                            }`}
                                                        >
                                                            {card.is_monthly ? monthlyLabel : "Off"}
                                                        </button>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-600">
                                                    {card.monthly_end_date || "—"}
                                                </td>
                                                <td className="px-4 py-3 text-sm">
                                                    <button
                                                        onClick={() => handleDelete(card.card_uid)}
                                                        className="text-red-600 hover:underline text-xs"
                                                    >
                                                        Delete
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Add Card Modal */}
            <Modal
                isOpen={showForm}
                onClose={() => setShowForm(false)}
                title="Add Card"
                mode="create"
                error={error}
                loading={formLoading}
                onSubmit={handleSubmit}
                submitText="Add"
            >
                <ParkingCardForm form={form} onChange={handleChange} lotOptions={lotOptions} />
            </Modal>
        </>
    );
}
