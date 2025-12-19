"use client";

import { useState, useEffect } from "react";
import { fetchAllMonthlySubs, createMonthlySub, deleteMonthlySub } from "../../../api/admin.client";

export function useMonthlySubs() {
    const [subs, setSubs] = useState([]);
    const [filteredSubs, setFilteredSubs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [searchQuery, setSearchQuery] = useState("");

    const [form, setForm] = useState({
        license_plate: "",
        vehicle_type: "car",
        start_date: "",
        months: 1,
        owner_name: "",
        owner_phone: "",
        payment_method: "CASH",
    });

    const [formLoading, setFormLoading] = useState(false);
    const [showForm, setShowForm] = useState(false);

    // Fetch subs on mount
    useEffect(() => {
        fetchAll();
    }, []);

    // Filter subscriptions when searchQuery or subs changes
    useEffect(() => {
        if (!searchQuery.trim()) {
            setFilteredSubs(subs);
            return;
        }
        
        const lowercasedQuery = searchQuery.toLowerCase();
        const results = subs.filter(sub => 
            sub.license_plate.toLowerCase().includes(lowercasedQuery) || 
            sub.vehicle_type.toLowerCase().includes(lowercasedQuery) ||
            sub.owner_name.toLowerCase().includes(lowercasedQuery) ||
            sub.owner_phone.toLowerCase().includes(lowercasedQuery)
        );
        setFilteredSubs(results);
    }, [searchQuery, subs]);

    // Handle search change
    const handleSearchChange = (e) => {
        setSearchQuery(e.target.value);
    };

    // Fetch all monthly subscriptions
    const fetchAll = async () => {
        setLoading(true);
        try {
            const data = await fetchAllMonthlySubs();
            setSubs(data);
            setFilteredSubs(data);
        } catch (err) {
            setError("Failed to fetch monthly subscriptions");
        } finally {
            setLoading(false);
        }
    };

    // Handle form change
    const handleChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    // Handle create form submit
    const handleSubmit = async (e) => {
        e.preventDefault();
        setFormLoading(true);
        setError("");
        try {
            if (
                !form.license_plate ||
                !form.vehicle_type ||
                !form.start_date ||
                !form.months ||
                !form.owner_name ||
                !form.owner_phone ||
                !form.payment_method
            ) {
                setError("All fields required");
                setFormLoading(false);
                return;
            }
            const result = await createMonthlySub(form);
            setSubs([...subs, result.newMonthlySub]);
            setShowForm(false);
            resetForm();
        } catch (err) {
            setError(err.response?.data?.message || err.message || "Failed to add monthly subscription");
        } finally {
            setFormLoading(false);
        }
    };

    // Reset create form
    const resetForm = () => {
        setForm({
            license_plate: "",
            vehicle_type: "car",
            start_date: "",
            months: 1,
            owner_name: "",
            owner_phone: "",
            payment_method: "CASH",
        });
    };

    // Handle delete
    const handleDelete = async (subId) => {
        if (!confirm("Are you sure you want to delete this monthly subscription?")) return;
        try {
            await deleteMonthlySub(subId);
            setSubs(subs.filter((sub) => sub.sub_id !== subId));
        } catch (error) {
            console.error(`Failed to delete subscription with ID ${subId}:`, error);
            toast.error("Failed to delete monthly subscription");
        }
    };

    // Vehicle type options for dropdown
    const vehicleTypeOptions = [
        { value: "car", label: "Car" },
        { value: "bike", label: "Bike" },
    ];
    
    // Payment method options for dropdown
    const paymentMethodOptions = [
        { value: "CASH", label: "Cash" },
        { value: "CARD", label: "Card" },
    ];

    // Column definitions for the table
    const columns = [
        { key: "license_plate", label: "License Plate" },
        { key: "vehicle_type", label: "Vehicle Type" },
        { key: "start_date", label: "Start Date" },
        { key: "end_date", label: "End Date" },
        { key: "owner_name", label: "Owner Name" },
        { key: "owner_phone", label: "Owner Phone" },
    ];

    return {
        subs: filteredSubs, // return filtered subscriptions instead of all subs
        allSubs: subs, // original unfiltered data
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
    };
}
