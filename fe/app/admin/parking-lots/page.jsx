"use client";

import PageHeader from "../../components/admin/PageHeader";
import DataTable from "../../components/common/DataTable";
import Modal from "../../components/common/Modal";
import ParkingLotForm from "../../components/admin/ParkingLotForm";
import { useParkingLots } from "../../components/admin/hooks/useParkingLots";

export default function ParkingLotsPage() {
    const {
        lots,
        loading,
        error,
        form,
        editForm,
        formLoading,
        showForm,
        showEditForm,
        searchQuery,
        managerOptions,
        columns,
        setShowForm,
        setShowEditForm,
        setError,
        handleChange,
        handleEditChange,
        handleSubmit,
        handleEditSubmit,
        handleEdit,
        handleDetail,
        handleDelete,
        handleSearchChange,
    } = useParkingLots();

    return (
        <>
            <PageHeader title="Parking Lots" buttonText="+ Add Parking Lot" onButtonClick={() => setShowForm(true)} />
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
                        id="parking-lot-search"
                        className="block w-full p-3 pl-10 text-sm text-gray-900 border border-gray-300 rounded-lg bg-white focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Search parking lots..."
                        value={searchQuery}
                        onChange={handleSearchChange}
                    />
                </div>
            </div>

            <DataTable
                columns={columns}
                data={lots}
                loading={loading}
                onEdit={handleEdit}
                onDetail={handleDetail}
                onDelete={handleDelete}
                idField="lot_id"
            />

            {/* Add Parking Lot Modal */}
            <Modal
                isOpen={showForm}
                onClose={() => setShowForm(false)}
                title="Add Parking Lot"
                mode="create"
                error={error}
                loading={formLoading}
                onSubmit={handleSubmit}
                submitText="Add"
            >
                <ParkingLotForm form={form} onChange={handleChange} managerOptions={managerOptions} />
            </Modal>

            {/* Edit Parking Lot Modal */}
            <Modal
                isOpen={showEditForm}
                onClose={() => setShowEditForm(false)}
                title="Edit Parking Lot"
                mode="update"
                error={error}
                loading={formLoading}
                onSubmit={handleEditSubmit}
                submitText="Save Changes"
            >
                <ParkingLotForm
                    form={editForm}
                    onChange={handleEditChange}
                    managerOptions={managerOptions}
                    isEditMode={true}
                />
            </Modal>
        </>
    );
}
