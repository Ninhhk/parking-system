"use client";

import PageHeader from "../../components/admin/PageHeader";
import DataTable from "../../components/common/DataTable";
import Modal from "../../components/common/Modal";
import MonthlySubForm from "../../components/admin/MonthlySubForm";
import { useMonthlySubs } from "../../components/admin/hooks/useMonthlySubs";

export default function MonthlySubsPage() {
    const {
        subs,
        loading,
        error,
        form,
        formLoading,
        showForm,
        searchQuery,
        vehicleTypeOptions,
        paymentMethodOptions,
        columns,
        setShowForm,
        setError,
        handleChange,
        handleSearchChange,
        handleSubmit,
        handleDelete,
    } = useMonthlySubs();

    return (
        <>
            <PageHeader
                title="Monthly Subscriptions"
                buttonText="+ Add Monthly Sub"
                onButtonClick={() => setShowForm(true)}
            />
            
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
                        id="subscription-search"
                        className="block w-full p-3 pl-10 text-sm text-gray-900 border border-gray-300 rounded-lg bg-white focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Search subscriptions..."
                        value={searchQuery}
                        onChange={handleSearchChange}
                    />
                </div>
            </div>

            <DataTable columns={columns} data={subs} loading={loading} onDelete={handleDelete} idField="sub_id" />

            {/* Add Monthly Sub Modal */}
            <Modal
                isOpen={showForm}
                onClose={() => {
                    setShowForm(false);
                    setError("");
                }}
                title="Add Monthly Subscription"
                mode="create"
                error={error}
                loading={formLoading}
                onSubmit={handleSubmit}
                submitText="Add"
            >
                <MonthlySubForm 
                    form={form} 
                    onChange={handleChange} 
                    vehicleTypeOptions={vehicleTypeOptions}
                    paymentMethodOptions={paymentMethodOptions}
                />
            </Modal>
        </>
    );
}
