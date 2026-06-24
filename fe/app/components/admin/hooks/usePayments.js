"use client";

import { useState, useEffect, useCallback } from "react";
import { fetchAllPayments } from "../../../api/admin.client";

const DEFAULT_PAGE_SIZE = 20;

export function usePayments() {
    const [payments, setPayments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [searchTerm, setSearchTerm] = useState("");
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState({ page: 1, pageSize: DEFAULT_PAGE_SIZE, totalCount: 0, totalPages: 0 });

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const response = await fetchAllPayments({ page, pageSize: DEFAULT_PAGE_SIZE, q: searchTerm });
            setPayments(response.payments || []);
            setPagination(response.pagination || { page: 1, pageSize: DEFAULT_PAGE_SIZE, totalCount: 0, totalPages: 0 });
        } catch (err) {
            setError("Failed to fetch payments");
            console.error("Error fetching payments:", err);
        } finally {
            setLoading(false);
        }
    }, [page, searchTerm]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Reset to page 1 when search changes
    const handleSearchChange = (value) => {
        setSearchTerm(value);
        setPage(1);
    };

    // Format payment date and amount
    const formatDate = (dateStr) => {
        if (!dateStr) return "";
        const date = new Date(dateStr);
        return date.toLocaleString("en-GB", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
        }).replace(/\//g, "-");
    };

    const formatAmount = (amount) => {
        if (!amount && amount !== 0) return "";
        return parseInt(amount, 10);
    };

    const paymentsWithFormatting = payments.map((payment) => ({
        ...payment,
        formatted_date: formatDate(payment.payment_date),
        formatted_amount: formatAmount(payment.total_amount),
    }));

    const columns = [
        { key: "payment_id", label: "ID" },
        { key: "formatted_date", label: "Time" },
        { key: "payment_method", label: "Method" },
        { key: "formatted_amount", label: "Amount" },
        { key: "session_id", label: "Session ID" },
    ];

    return {
        payments: paymentsWithFormatting,
        loading,
        error,
        searchTerm,
        setSearchTerm: handleSearchChange,
        columns,
        page,
        setPage,
        pagination,
    };
}
