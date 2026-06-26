"use client";

import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import {
    fetchParkingCards,
    fetchCardInventory,
    addParkingCard,
    setParkingCardStatus,
    deleteParkingCard,
    fetchParkingLots,
    updateCardMonthly,
} from "../../../api/admin.client";

/**
 * Pure search filter for the card pool (Req 1.4).
 *
 * Returns the cards whose `card_uid` or `lot_name` contains `query`
 * (case-insensitive). Preserves the relative order of the input list and
 * returns the full list for an empty/whitespace query. Exported standalone so
 * it can be exercised directly by the search property test.
 *
 * @param {Array<{card_uid: string, lot_name: string|null}>} cards
 * @param {string} query
 * @returns {Array} matching cards, a subset of `cards` in the original order
 */
export function filterCards(cards, query) {
    if (!query || !query.trim()) {
        return cards;
    }
    const lowercasedQuery = query.toLowerCase();
    return cards.filter((card) => {
        const uid = (card.card_uid || "").toLowerCase();
        const lotName = (card.lot_name || "").toLowerCase();
        return uid.includes(lowercasedQuery) || lotName.includes(lowercasedQuery);
    });
}

export function useParkingCards() {
    const [cards, setCards] = useState([]);
    const [inventory, setInventory] = useState({ total: 0, available: 0, lost: 0 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [searchQuery, setSearchQuery] = useState("");

    const [form, setForm] = useState({ card_uid: "", lot_id: null });
    const [formLoading, setFormLoading] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [lotOptions, setLotOptions] = useState([]);

    // Fetch cards + inventory on mount
    useEffect(() => {
        fetchAll();
    }, []);

    // Fetch lots once for the Assigned_Lot selector in the add form
    useEffect(() => {
        async function loadLots() {
            try {
                const lots = await fetchParkingLots();
                setLotOptions((lots || []).map((lot) => ({ value: lot.lot_id, label: lot.lot_name })));
            } catch (err) {
                console.error("Failed to fetch parking lots:", err);
                setLotOptions([]);
            }
        }
        loadLots();
    }, []);

    // Fetch all pool cards and inventory counts
    const fetchAll = async () => {
        setLoading(true);
        try {
            const [cardsData, inventoryData] = await Promise.all([
                fetchParkingCards(),
                fetchCardInventory(),
            ]);
            setCards(cardsData || []);
            setInventory(inventoryData || { total: 0, available: 0, lost: 0 });
        } catch (err) {
            setError("Failed to fetch parking cards");
        } finally {
            setLoading(false);
        }
    };

    // Handle add form change
    const handleChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    // Handle search change
    const handleSearchChange = (e) => {
        setSearchQuery(e.target.value);
    };

    // Reset add form
    const resetForm = () => {
        setForm({ card_uid: "", lot_id: null });
    };

    // Handle add form submit (lot_id null = Shared)
    const handleSubmit = async (e) => {
        e.preventDefault();
        setFormLoading(true);
        setError("");
        try {
            await addParkingCard({ card_uid: form.card_uid, lot_id: form.lot_id ?? null });
            setShowForm(false);
            resetForm();
            await fetchAll();
        } catch (err) {
            setError(err.response?.data?.message || err.message || "Failed to add card");
        } finally {
            setFormLoading(false);
        }
    };

    // Handle delete (409 = card in use, surfaced as a toast per Req 3.4)
    const handleDelete = async (cardUid) => {
        if (!confirm("Are you sure you want to delete this card?")) return;
        try {
            await deleteParkingCard(cardUid);
            await fetchAll();
        } catch (err) {
            if (err.response?.status === 409) {
                toast.error("Card is in use and cannot be deleted");
            } else {
                toast.error("Failed to delete card");
            }
        }
    };

    // Toggle a card between available and lost
    const handleToggleStatus = async (card) => {
        const nextStatus = card.status === "lost" ? "available" : "lost";
        try {
            await setParkingCardStatus(card.card_uid, nextStatus);
            await fetchAll();
        } catch (err) {
            toast.error("Failed to update card status");
        }
    };

    // Column definitions for the table
    const columns = [
        { key: "card_uid", label: "Card UID" },
        { key: "lot_name", label: "Assigned Lot" },
        { key: "status", label: "Status" },
        { key: "monthly_status", label: "Monthly" },
        { key: "monthly_end_date", label: "Expires" },
        { key: "created_at", label: "Created At" },
    ];

    // Toggle monthly subscription on a card
    const handleToggleMonthly = async (card, endDate) => {
        const nextMonthly = !card.is_monthly;
        try {
            await updateCardMonthly(card.card_uid, {
                is_monthly: nextMonthly,
                monthly_end_date: nextMonthly ? (endDate || null) : null,
            });
            toast.success(nextMonthly ? "Monthly enabled" : "Monthly disabled");
            await fetchAll();
        } catch (err) {
            toast.error(err.response?.data?.message || "Failed to update monthly status");
        }
    };

    return {
        cards: filterCards(cards, searchQuery), // filtered list for display
        allCards: cards, // original unfiltered data
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
        setError,
        handleChange,
        handleSearchChange,
        handleSubmit,
        handleDelete,
        handleToggleStatus,
        handleToggleMonthly,
    };
}
