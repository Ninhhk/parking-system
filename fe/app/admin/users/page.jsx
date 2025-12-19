"use client";

import PageHeader from "../../components/admin/PageHeader";
import DataTable from "../../components/common/DataTable";
import Modal from "../../components/common/Modal";
import UserForm from "../../components/admin/UserForm";
import { useUsers } from "../../components/admin/hooks/useUsers";

export default function UsersPage() {
    const {
        users,
        loading,
        error,
        form,
        editForm,
        formLoading,
        showForm,
        showEditForm,
        searchQuery,
        roleOptions,
        columns,
        setShowForm,
        setShowEditForm,
        setError,
        handleChange,
        handleEditChange,
        handleSubmit,
        handleEditSubmit,
        handleEdit,
        handleDelete,
        handleSearchChange,
    } = useUsers();

    return (
        <>
            <PageHeader title="Users Management" buttonText="+ Add User" onButtonClick={() => setShowForm(true)} />
            
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
                        id="user-search"
                        className="block w-full p-3 pl-10 text-sm text-gray-900 border border-gray-300 rounded-lg bg-white focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Search users..."
                        value={searchQuery}
                        onChange={handleSearchChange}
                    />
                </div>
            </div>

            <DataTable
                columns={columns}
                data={users}
                loading={loading}
                onEdit={handleEdit}
                onDelete={handleDelete}
                idField="user_id"
            />

            {/* Add User Modal */}
            <Modal
                isOpen={showForm}
                onClose={() => {
                    setShowForm(false);
                    setError("");
                }}
                title="Add User"
                mode="create"
                error={error}
                loading={formLoading}
                onSubmit={handleSubmit}
                submitText="Add"
            >
                <UserForm form={form} onChange={handleChange} roleOptions={roleOptions} />
            </Modal>

            {/* Edit User Modal */}
            <Modal
                isOpen={showEditForm}
                onClose={() => {
                    setShowEditForm(false);
                    setError("");
                }}
                title="Edit User"
                mode="update"
                error={error}
                loading={formLoading}
                onSubmit={handleEditSubmit}
                submitText="Save Changes"
            >
                <UserForm form={editForm} onChange={handleEditChange} roleOptions={roleOptions} isEditMode={true} />
            </Modal>
        </>
    );
}
