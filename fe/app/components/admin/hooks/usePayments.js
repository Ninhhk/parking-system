"use client";

import { useState, useEffect } from "react";
import { fetchAllPayments } from "../../../api/admin.client";

export function usePayments() {
    const [payments, setPayments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [searchTerm, setSearchTerm] = useState("");
      // Fetch payments on mount
    useEffect(() => {
        fetchAll();
    }, []);
    
    // Fetch all payments
    const fetchAll = async () => {
        setLoading(true);
        try {
            const response = await fetchAllPayments();
            // Handle payments data structure from the API
            const paymentsData = response.payments || response || [];
            setPayments(Array.isArray(paymentsData) ? paymentsData : []);
        } catch (err) {
            setError("Failed to fetch payments");
            console.error("Error fetching payments:", err);
        } finally {
            setLoading(false);
        }
    };
      // Format payment date and amount
    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return date.toLocaleString('en-GB', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        }).replace(/\//g, '-');
    };
    
    const formatAmount = (amount) => {
        if (!amount && amount !== 0) return '';
        return parseInt(amount, 10);
    };

    // Add formatted values to payment objects
    const paymentsWithFormatting = payments.map(payment => ({
        ...payment,
        formatted_date: formatDate(payment.payment_date),
        formatted_amount: formatAmount(payment.total_amount)
    }));
    
    // Filter payments based on search term
    const filteredPayments = searchTerm 
        ? paymentsWithFormatting.filter(payment => 
            Object.values(payment)
                .some(value => 
                    String(value).toLowerCase().includes(searchTerm.toLowerCase())
                )
        )
        : paymentsWithFormatting;
      // Column definitions for the table
    const columns = [
        { key: "payment_id", label: "ID" },
        { key: "formatted_date", label: "Time" },
        { key: "payment_method", label: "Method" },
        { key: "formatted_amount", label: "Amount" },
        { key: "session_id", label: "Session ID" },
        { key: "sub_id", label: "Subscription ID" },
    ];
    
    return {
        payments: filteredPayments,
        loading,
        error,
        searchTerm,
        setSearchTerm,
        columns,
    };
}
