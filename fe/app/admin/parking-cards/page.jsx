"use client";

import { useState, Fragment } from "react";
import PageHeader from "../../components/admin/PageHeader";
import Modal from "../../components/common/Modal";
import ParkingCardForm from "../../components/admin/ParkingCardForm";
import { useParkingCards } from "../../components/admin/hooks/useParkingCards";
import { fetchCardHolder, upsertCardHolder, deleteCardHolder } from "../../api/admin.client";
import { toast } from "react-hot-toast";
import api from "../../api/client.config";

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

    // Holder detail expansion + inline editing
    const [expandedCard, setExpandedCard] = useState(null); // card_uid
    const [holderData, setHolderData] = useState(null);
    const [holderLoading, setHolderLoading] = useState(false);
    const [holderEditing, setHolderEditing] = useState(false);
    const [holderForm, setHolderForm] = useState({ holder_name: "", holder_phone: "", license_plate: "", vehicle_type: "" });
    const [holderSaving, setHolderSaving] = useState(false);

    // Batch import/export state
    const [batchOpen, setBatchOpen] = useState(false);
    const [batchEntity, setBatchEntity] = useState("cards");
    const [batchFile, setBatchFile] = useState(null);
    const [batchLoading, setBatchLoading] = useState(false);
    const [batchCommitting, setBatchCommitting] = useState(false);
    const [batchPreview, setBatchPreview] = useState(null);
    const [batchError, setBatchError] = useState("");
    const [batchSuccess, setBatchSuccess] = useState("");

    const handleBatchPreview = async () => {
        if (!batchFile) return;
        setBatchLoading(true);
        setBatchError("");
        setBatchPreview(null);
        setBatchSuccess("");
        try {
            const formData = new FormData();
            formData.append("file", batchFile);
            const res = await api.post(`/admin/import/${batchEntity}/preview`, formData, {
                headers: { "Content-Type": "multipart/form-data" },
            });
            setBatchPreview(res.data.data);
        } catch (err) {
            setBatchError(err.response?.data?.message || "Preview failed");
        } finally {
            setBatchLoading(false);
        }
    };

    const handleBatchCommit = async () => {
        if (!batchFile) return;
        setBatchCommitting(true);
        setBatchError("");
        setBatchSuccess("");
        try {
            const formData = new FormData();
            formData.append("file", batchFile);
            const res = await api.post(`/admin/import/${batchEntity}/commit`, formData, {
                headers: { "Content-Type": "multipart/form-data" },
            });
            setBatchSuccess(`Committed ${res.data.data?.count || ""} rows successfully.`);
            setBatchPreview(null);
            setBatchFile(null);
        } catch (err) {
            if (err.response?.status === 422 && err.response?.data?.errors) {
                setBatchPreview({ valid: false, errors: err.response.data.errors, totalRows: 0, preview: [] });
            }
            setBatchError(err.response?.data?.message || "Commit failed");
        } finally {
            setBatchCommitting(false);
        }
    };

    const handleBatchDownload = async (type) => {
        try {
            const exportUrls = { cards: "/admin/export/cards", subs: "/admin/export/subs" };
            const url = type === "template"
                ? `/admin/import/${batchEntity}/template`
                : exportUrls[batchEntity];
            const res = await api.get(url, { responseType: "blob" });
            const blob = new Blob([res.data], {
                type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            });
            const link = document.createElement("a");
            link.href = window.URL.createObjectURL(blob);
            const exportNames = { cards: "parking_cards.xlsx", subs: "monthly_subscriptions.xlsx" };
            link.download = type === "template" ? `${batchEntity}_template.xlsx` : exportNames[batchEntity];
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(link.href);
        } catch (err) {
            setBatchError(err.response?.data?.message || "Download failed");
        }
    };

    const handleExpandHolder = async (cardUid) => {
        if (expandedCard === cardUid) {
            setExpandedCard(null);
            setHolderData(null);
            setHolderEditing(false);
            return;
        }
        setExpandedCard(cardUid);
        setHolderEditing(false);
        setHolderLoading(true);
        try {
            const holder = await fetchCardHolder(cardUid);
            setHolderData(holder);
        } catch {
            setHolderData(null);
        } finally {
            setHolderLoading(false);
        }
    };

    const startEditHolder = () => {
        setHolderForm({
            holder_name: holderData?.holder_name || "",
            holder_phone: holderData?.holder_phone || "",
            license_plate: holderData?.license_plate || "",
            vehicle_type: holderData?.vehicle_type || "",
        });
        setHolderEditing(true);
    };

    const handleHolderFormChange = (e) => {
        setHolderForm({ ...holderForm, [e.target.name]: e.target.value });
    };

    const handleSaveHolder = async () => {
        if (!holderForm.holder_name.trim() || !holderForm.holder_phone.trim()) {
            toast.error("Name and phone are required");
            return;
        }
        setHolderSaving(true);
        try {
            const saved = await upsertCardHolder(expandedCard, holderForm);
            setHolderData(saved);
            setHolderEditing(false);
            toast.success("Holder saved");
        } catch (err) {
            toast.error(err.response?.data?.message || "Failed to save holder");
        } finally {
            setHolderSaving(false);
        }
    };

    const handleDeleteHolder = async () => {
        if (!confirm("Remove holder info from this card?")) return;
        setHolderSaving(true);
        try {
            await deleteCardHolder(expandedCard);
            setHolderData(null);
            setHolderEditing(false);
            toast.success("Holder removed");
        } catch (err) {
            toast.error(err.response?.data?.message || "Failed to remove holder");
        } finally {
            setHolderSaving(false);
        }
    };

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
                                        const isExpanded = expandedCard === card.card_uid;
                                        return (
                                            <Fragment key={card.card_uid}>
                                            <tr className="hover:bg-gray-50">
                                                <td
                                                    className={`px-4 py-3 text-sm font-mono ${card.is_monthly ? "text-blue-600 cursor-pointer hover:underline" : "text-gray-900"}`}
                                                    onClick={() => card.is_monthly && handleExpandHolder(card.card_uid)}
                                                    title={card.is_monthly ? "Click to view holder info" : ""}
                                                >
                                                    {card.card_uid}
                                                </td>
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
                                            {isExpanded && card.is_monthly && (
                                                <tr className="bg-gray-50">
                                                    <td colSpan={6} className="px-6 py-3">
                                                        {holderLoading ? (
                                                            <p className="text-sm text-gray-500">Loading holder info...</p>
                                                        ) : holderEditing ? (
                                                            <div className="text-sm space-y-2">
                                                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                                                    <input
                                                                        name="holder_name"
                                                                        value={holderForm.holder_name}
                                                                        onChange={handleHolderFormChange}
                                                                        placeholder="Name *"
                                                                        className="border border-gray-300 rounded px-2 py-1 text-sm"
                                                                    />
                                                                    <input
                                                                        name="holder_phone"
                                                                        value={holderForm.holder_phone}
                                                                        onChange={handleHolderFormChange}
                                                                        placeholder="Phone *"
                                                                        className="border border-gray-300 rounded px-2 py-1 text-sm"
                                                                    />
                                                                    <input
                                                                        name="license_plate"
                                                                        value={holderForm.license_plate}
                                                                        onChange={handleHolderFormChange}
                                                                        placeholder="License plate"
                                                                        className="border border-gray-300 rounded px-2 py-1 text-sm"
                                                                    />
                                                                    <select
                                                                        name="vehicle_type"
                                                                        value={holderForm.vehicle_type}
                                                                        onChange={handleHolderFormChange}
                                                                        className="border border-gray-300 rounded px-2 py-1 text-sm"
                                                                    >
                                                                        <option value="">Vehicle type</option>
                                                                        <option value="car">Car</option>
                                                                        <option value="motorbike">Motorbike</option>
                                                                    </select>
                                                                </div>
                                                                <div className="flex gap-2">
                                                                    <button
                                                                        onClick={handleSaveHolder}
                                                                        disabled={holderSaving}
                                                                        className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300"
                                                                    >
                                                                        {holderSaving ? "Saving..." : "Save"}
                                                                    </button>
                                                                    <button
                                                                        onClick={() => setHolderEditing(false)}
                                                                        className="px-3 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                                                                    >
                                                                        Cancel
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ) : holderData ? (
                                                            <div className="text-sm text-gray-700">
                                                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
                                                                    <div><span className="font-medium">Name:</span> {holderData.holder_name}</div>
                                                                    <div><span className="font-medium">Phone:</span> {holderData.holder_phone}</div>
                                                                    <div><span className="font-medium">Plate:</span> {holderData.license_plate || "—"}</div>
                                                                    <div><span className="font-medium">Vehicle:</span> {holderData.vehicle_type || "—"}</div>
                                                                </div>
                                                                <div className="flex gap-2">
                                                                    <button
                                                                        onClick={startEditHolder}
                                                                        className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                                                                    >
                                                                        Edit
                                                                    </button>
                                                                    <button
                                                                        onClick={handleDeleteHolder}
                                                                        disabled={holderSaving}
                                                                        className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                                                                    >
                                                                        Remove
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="text-sm">
                                                                <p className="text-gray-400 mb-2">No holder registered for this card</p>
                                                                <button
                                                                    onClick={startEditHolder}
                                                                    className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                                                                >
                                                                    + Add Holder
                                                                </button>
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            )}
                                            </Fragment>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Batch Import/Export Panel */}
            <div className="mt-6 bg-white shadow-md rounded-lg border border-gray-200">
                <button
                    onClick={() => setBatchOpen(!batchOpen)}
                    className="w-full px-6 py-4 flex justify-between items-center text-left hover:bg-gray-50 transition-colors"
                >
                    <h2 className="text-lg font-semibold text-gray-800">Batch Import / Export</h2>
                    <svg className={`w-5 h-5 text-gray-500 transition-transform ${batchOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                </button>
                {batchOpen && (
                    <div className="px-6 pb-6 border-t border-gray-100 pt-4">
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
                                <select
                                    value={batchEntity}
                                    onChange={(e) => { setBatchEntity(e.target.value); setBatchPreview(null); setBatchError(""); setBatchSuccess(""); }}
                                    className="block w-full border border-gray-300 rounded px-3 py-2 text-sm"
                                >
                                    <option value="cards">Cards</option>
                                    <option value="subs">Monthly Subscriptions</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">File (.xlsx)</label>
                                <input
                                    type="file"
                                    accept=".xlsx"
                                    onChange={(e) => { setBatchFile(e.target.files[0] || null); setBatchPreview(null); setBatchError(""); setBatchSuccess(""); }}
                                    className="block w-full text-sm border border-gray-300 rounded p-1.5"
                                />
                            </div>
                            <div>
                                <button
                                    onClick={handleBatchPreview}
                                    disabled={!batchFile || batchLoading}
                                    className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300 text-sm font-medium"
                                >
                                    {batchLoading ? "Parsing..." : "Preview"}
                                </button>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleBatchDownload("template")}
                                    className="px-3 py-2 bg-gray-100 text-gray-700 border border-gray-300 rounded hover:bg-gray-200 text-xs font-medium"
                                >
                                    Template
                                </button>
                                <button
                                    onClick={() => handleBatchDownload("export")}
                                    className="px-3 py-2 bg-emerald-50 text-emerald-700 border border-emerald-300 rounded hover:bg-emerald-100 text-xs font-medium"
                                >
                                    Export Current
                                </button>
                            </div>
                        </div>
                        {batchEntity === "subs" && (
                            <p className="mt-2 text-xs text-gray-500">
                                Leave Action blank to upsert (enable monthly + set holder). Set Action to &quot;cancel&quot; to disable monthly + remove holder.
                            </p>
                        )}

                        {batchError && <p className="mt-3 text-sm text-red-600">{batchError}</p>}
                        {batchSuccess && <p className="mt-3 text-sm text-green-600">{batchSuccess}</p>}

                        {batchPreview && (
                            <div className="mt-4 border border-gray-200 rounded overflow-hidden">
                                <div className="bg-gray-50 px-4 py-2 flex justify-between items-center">
                                    <span className="text-sm text-gray-700">
                                        {batchPreview.totalRows} rows — {batchPreview.valid ? "All valid" : `${batchPreview.errors?.length || 0} error(s)`}
                                    </span>
                                    {batchPreview.valid && (
                                        <button
                                            onClick={handleBatchCommit}
                                            disabled={batchCommitting}
                                            className="px-4 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400 text-xs font-medium"
                                        >
                                            {batchCommitting ? "Committing..." : "Commit"}
                                        </button>
                                    )}
                                </div>
                                {batchPreview.errors?.length > 0 && (
                                    <ul className="px-4 py-2 bg-red-50 text-xs text-red-700 max-h-32 overflow-y-auto list-disc list-inside">
                                        {batchPreview.errors.map((err, i) => (
                                            <li key={i}>Row {err.row}{err.field ? ` [${err.field}]` : ""}: {err.reason}</li>
                                        ))}
                                    </ul>
                                )}
                                {batchPreview.preview?.length > 0 && (
                                    <div className="overflow-x-auto max-h-48">
                                        <table className="min-w-full text-xs">
                                            <thead className="bg-gray-100">
                                                <tr>
                                                    <th className="px-2 py-1 text-left text-gray-500">Row</th>
                                                    {Object.keys(batchPreview.preview[0]).filter(k => k !== "__row").map(col => (
                                                        <th key={col} className="px-2 py-1 text-left text-gray-500">{col}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {batchPreview.preview.map(row => (
                                                    <tr key={row.__row} className={batchPreview.errors?.some(e => e.row === row.__row) ? "bg-red-50" : ""}>
                                                        <td className="px-2 py-1 text-gray-500">{row.__row}</td>
                                                        {Object.keys(row).filter(k => k !== "__row").map(col => (
                                                            <td key={col} className="px-2 py-1">{row[col] ?? ""}</td>
                                                        ))}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
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
