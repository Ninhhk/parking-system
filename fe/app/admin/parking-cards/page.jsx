"use client";

import PageHeader from "../../components/admin/PageHeader";
import DataTable from "../../components/common/DataTable";
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
        columns,
        setShowForm,
        handleChange,
        handleSearchChange,
        handleSubmit,
        handleDelete,
    } = useParkingCards();

    // Display rows: render Assigned_Lot as "Shared" when lot_id is null (Req 1.3)
    // and format created_at for readability. DataTable renders item[column.key]
    // directly, so transformation happens here.
    const displayCards = cards.map((card) => ({
        ...card,
        lot_name: card.lot_id === null ? "Shared" : card.lot_name,
        created_at: card.created_at ? new Date(card.created_at).toLocaleString() : "",
    }));

    return (
        <>
            <PageHeader title="Card Pool" buttonText="+ Add Card" onButtonClick={() => setShowForm(true)} />

            {/* Inventory counts (Req 5.1) */}
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

            {/* Search Bar (Req 1.4) */}
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

            {/* Card table (Req 1.1) */}
            <DataTable
                columns={columns}
                data={displayCards}
                loading={loading}
                onDelete={handleDelete}
                idField="card_uid"
            />

            {/* Add Card Modal (Req 2.x) */}
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
