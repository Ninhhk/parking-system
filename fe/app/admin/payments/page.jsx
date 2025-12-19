"use client";

import { useState } from "react";
import PageHeader from "../../components/admin/PageHeader";
import DataTable from "../../components/common/DataTable";
import { usePayments } from "../../components/admin/hooks/usePayments";
import { FaSearch, FaTimes } from "react-icons/fa";

export default function PaymentsPage() {
    const {
        payments,
        loading,
        error,
        searchTerm,
        setSearchTerm,
        columns,
    } = usePayments();

    const clearSearch = () => {
        setSearchTerm("");
    };

    return (
        <>
            <PageHeader title="Payment Management" />

            {/* Search Bar */}
            <div className="mb-6">
                <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <FaSearch className="h-4 w-4 text-gray-400" />
                    </span>
                    {searchTerm && (
                        <button onClick={clearSearch} className="absolute inset-y-0 right-0 pr-3 flex items-center">
                            <FaTimes className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                        </button>
                    )}
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search payments..."
                        className="block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                    />
                </div>
            </div>

            <DataTable columns={columns} data={payments} loading={loading} idField="payment_id" />

            {error && <div className="text-red-600 mt-4">{error}</div>}
        </>
    );
}