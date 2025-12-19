"use client";

import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import {
    fetchParkingLots,
    addParkingLot,
    updateParkingLot,
    deleteParkingLot,
    fetchFreeEmployees,
} from "../../../api/admin.client";

export function useParkingLots() {
    const [lots, setLots] = useState([]);
    const [filteredLots, setFilteredLots] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [searchQuery, setSearchQuery] = useState("");

    const [form, setForm] = useState({
        lot_name: "",
        car_capacity: "",
        bike_capacity: "",
    });

    const [editForm, setEditForm] = useState({
        lot_id: "",
        lot_name: "",
        car_capacity: "",
        bike_capacity: "",
        managed_by: "",
    });

    const [formLoading, setFormLoading] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [showEditForm, setShowEditForm] = useState(false);
    const [users, setUsers] = useState([]);

    // Fetch parking lots on mount
    useEffect(() => {
        fetchAllLots();
    }, []);

    // Filter lots when searchQuery or lots changes
    useEffect(() => {
        if (!searchQuery.trim()) {
            setFilteredLots(lots);
            return;
        }
        
        const lowercasedQuery = searchQuery.toLowerCase();
        const results = lots.filter(lot => 
            lot.lot_name.toLowerCase().includes(lowercasedQuery) || 
            (lot.manager_username && lot.manager_username.toLowerCase().includes(lowercasedQuery))
        );
        setFilteredLots(results);
    }, [searchQuery, lots]);

    // Fetch users for manager dropdown
    useEffect(() => {
        async function fetchUsers() {
            try {
                const usersData = await fetchFreeEmployees();
                setUsers(usersData || []);
            } catch (error) {
                console.error("Failed to fetch users:", error);
                setUsers([]); // Set empty array as fallback
            }
        }
        fetchUsers();
    }, [lots]); // Re-run when lots change to update free employees list

    // Fetch all parking lots
    const fetchAllLots = async () => {
        setLoading(true);
        try {
            const data = await fetchParkingLots();
            setLots(data);
        } catch (err) {
            setError("Failed to fetch parking lots");
        } finally {
            setLoading(false);
        }
    };

    // Handle form change
    const handleChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    // Handle edit form change
    const handleEditChange = (e) => {
        setEditForm({ ...editForm, [e.target.name]: e.target.value });
    };

    // Handle create form submit
    const handleSubmit = async (e) => {
        e.preventDefault();
        setFormLoading(true);
        setError("");
        try {
            const newLot = await addParkingLot(form);
            setLots([...lots, newLot]);
            setShowForm(false);
            resetForm();
        } catch (err) {
            setError(err.response?.data?.message || err.message || "Failed to add parking lot");
        } finally {
            setFormLoading(false);
        }
    };

    // Reset create form
    const resetForm = () => {
        setForm({ lot_name: "", car_capacity: "", bike_capacity: "" });
    };

    // Handle edit button click
    const handleEdit = (lot) => {
        setEditForm({
            lot_id: lot.lot_id,
            lot_name: lot.lot_name,
            car_capacity: lot.car_capacity,
            bike_capacity: lot.bike_capacity,
            managed_by: lot.managed_by || "", // Convert null to empty string for the form
        });
        setShowEditForm(true);
    };

    // Handle edit form submit
    const handleEditSubmit = async (e) => {
        e.preventDefault();
        setFormLoading(true);
        setError("");
        try {
            const { lot_id, ...updateData } = editForm;
            const updatedLot = await updateParkingLot(lot_id, updateData);

            // Update the lot in the state
            setLots(lots.map((lot) => (lot.lot_id === updatedLot.lot_id ? updatedLot : lot)));
            setShowEditForm(false);
            
            // Refresh the lots to get updated manager information
            fetchAllLots();
        } catch (error) {
            console.error(`Failed to update lot:`, error);
            setError(error.response?.data?.message || error.message || "Failed to update parking lot");
        } finally {
            setFormLoading(false);
        }
    };

    // Handle detail
    const handleDetail = (lotId) => {
        window.location.href = `/admin/parking-lots/${lotId}`;
    };

    // Handle delete
    const handleDelete = async (lotId) => {
        if (!confirm("Are you sure you want to delete this parking lot?")) return;
        try {
            await deleteParkingLot(lotId);
            setLots(lots.filter((lot) => lot.lot_id !== lotId));
        } catch (error) {
            console.error(`Failed to delete lot with ID ${lotId}:`, error);
            toast.error("Failed to delete parking lot");
        }
    };

    // Handle search change
    const handleSearchChange = (e) => {
        setSearchQuery(e.target.value);
    };

    // Manager options for dropdown
    const managerOptions = [
        { value: "", label: "None" },
        ...users.map((user) => ({ value: user.user_id, label: user.username })),
    ];

    // In edit mode, also include the currently assigned manager if they're not in the free employees list
    if (showEditForm && editForm.managed_by && !users.find(user => user.user_id === editForm.managed_by)) {
        // Find the current manager from all lots data
        const currentManager = lots.find(lot => lot.lot_id === editForm.lot_id);
        if (currentManager && currentManager.manager_username) {
            managerOptions.push({ 
                value: editForm.managed_by, 
                label: `${currentManager.manager_username} (Currently Assigned)` 
            });
        }
    }

    // Add a fallback if no users are available
    if (managerOptions.length === 1) {
        console.log("No employees available for assignment");
    }

    // Column definitions for the table
    const columns = [
        { key: "lot_name", label: "Name" },
        { key: "car_capacity", label: "Car Capacity" },
        { key: "bike_capacity", label: "Bike Capacity" },
        { key: "manager_username", label: "Managed by" },
    ];

    return {
        lots: filteredLots, // return filtered lots instead of all lots
        allLots: lots, // original unfiltered data
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
    };
}
