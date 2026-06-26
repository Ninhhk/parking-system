"use client";

import { useState } from "react";
import { HiOutlineMagnifyingGlass, HiOutlineArrowPath } from "react-icons/hi2";

const INITIAL_FILTERS = {
    plate: "",
    sessionId: "",
    cardUid: "",
    startDate: "",
    endDate: "",
    vehicleType: "",
    lotId: "",
    status: "",
};

const FilterBar = ({ onSearch, onReset, lots = [] }) => {
    const [filters, setFilters] = useState(INITIAL_FILTERS);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFilters((prev) => ({ ...prev, [name]: value }));
    };

    const handleSearch = () => {
        const activeFilters = {};
        if (filters.plate.trim()) activeFilters.plate = filters.plate.trim();
        if (filters.sessionId.trim()) activeFilters.sessionId = filters.sessionId.trim();
        if (filters.cardUid.trim()) activeFilters.cardUid = filters.cardUid.trim();
        if (filters.startDate) activeFilters.startDate = filters.startDate;
        if (filters.endDate) activeFilters.endDate = filters.endDate;
        if (filters.vehicleType) activeFilters.vehicleType = filters.vehicleType;
        if (filters.lotId) activeFilters.lotId = filters.lotId;
        if (filters.status) activeFilters.status = filters.status;
        onSearch(activeFilters);
    };

    const handleReset = () => {
        setFilters(INITIAL_FILTERS);
        if (onReset) onReset();
    };

    return (
        <div className="bg-slate-50/50 border border-slate-150 rounded-xl p-5 mb-6 shadow-2xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                {/* Plate search */}
                <div>
                    <label htmlFor="plate" className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono mb-1.5">
                        License Plate
                    </label>
                    <input
                        type="text"
                        id="plate"
                        name="plate"
                        value={filters.plate}
                        onChange={handleChange}
                        placeholder="Search plate..."
                        className="w-full border border-gray-250/80 rounded-lg px-3 py-2 text-xs font-mono bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all shadow-2xs"
                    />
                </div>

                {/* Session ID search */}
                <div>
                    <label htmlFor="sessionId" className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono mb-1.5">
                        Session ID
                    </label>
                    <input
                        type="text"
                        inputMode="numeric"
                        id="sessionId"
                        name="sessionId"
                        value={filters.sessionId}
                        onChange={handleChange}
                        placeholder="Search session ID..."
                        className="w-full border border-gray-250/80 rounded-lg px-3 py-2 text-xs font-mono bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all shadow-2xs"
                    />
                </div>

                {/* Card ID search */}
                <div>
                    <label htmlFor="cardUid" className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono mb-1.5">
                        Card ID
                    </label>
                    <input
                        type="text"
                        id="cardUid"
                        name="cardUid"
                        value={filters.cardUid}
                        onChange={handleChange}
                        placeholder="Search card ID..."
                        className="w-full border border-gray-250/80 rounded-lg px-3 py-2 text-xs font-mono bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all shadow-2xs"
                    />
                </div>

                {/* Start date */}
                <div>
                    <label htmlFor="startDate" className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono mb-1.5">
                        Start Date
                    </label>
                    <input
                        type="date"
                        id="startDate"
                        name="startDate"
                        value={filters.startDate}
                        onChange={handleChange}
                        className="w-full border border-gray-250/80 rounded-lg px-3 py-2 text-xs font-mono bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all shadow-2xs"
                    />
                </div>

                {/* End date */}
                <div>
                    <label htmlFor="endDate" className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono mb-1.5">
                        End Date
                    </label>
                    <input
                        type="date"
                        id="endDate"
                        name="endDate"
                        value={filters.endDate}
                        onChange={handleChange}
                        className="w-full border border-gray-250/80 rounded-lg px-3 py-2 text-xs font-mono bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all shadow-2xs"
                    />
                </div>

                {/* Vehicle type */}
                <div>
                    <label htmlFor="vehicleType" className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono mb-1.5">
                        Vehicle Type
                    </label>
                    <select
                        id="vehicleType"
                        name="vehicleType"
                        value={filters.vehicleType}
                        onChange={handleChange}
                        className="w-full border border-gray-250/80 rounded-lg px-3 py-2 text-xs font-mono bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all shadow-2xs"
                    >
                        <option value="">All</option>
                        <option value="car">Car</option>
                        <option value="bike">Bike</option>
                    </select>
                </div>

                {/* Lot dropdown */}
                <div>
                    <label htmlFor="lotId" className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono mb-1.5">
                        Parking Lot
                    </label>
                    <select
                        id="lotId"
                        name="lotId"
                        value={filters.lotId}
                        onChange={handleChange}
                        className="w-full border border-gray-250/80 rounded-lg px-3 py-2 text-xs font-mono bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all shadow-2xs"
                    >
                        <option value="">All Lots</option>
                        {lots.map((lot) => (
                            <option key={lot.lot_id} value={lot.lot_id}>
                                {lot.lot_name}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Status filter */}
                <div>
                    <label htmlFor="status" className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono mb-1.5">
                        Status
                    </label>
                    <select
                        id="status"
                        name="status"
                        value={filters.status}
                        onChange={handleChange}
                        className="w-full border border-gray-250/80 rounded-lg px-3 py-2 text-xs font-mono bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all shadow-2xs"
                    >
                        <option value="">All</option>
                        <option value="active">Active</option>
                        <option value="completed">Completed</option>
                        <option value="lost_ticket">Lost Ticket</option>
                    </select>
                </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3 mt-5">
                <button
                    onClick={handleSearch}
                    className="cursor-pointer bg-white hover:bg-slate-50 text-slate-600 border border-gray-200 px-5 py-2 text-xs font-bold font-mono tracking-wider uppercase rounded-lg shadow-2xs hover:shadow-xs transition-all flex items-center gap-1.5"
                >
                    <HiOutlineMagnifyingGlass className="h-3.5 w-3.5 stroke-[2.5]" />
                    Search
                </button>
                <button
                    onClick={handleReset}
                    className="cursor-pointer bg-white hover:bg-slate-50 text-slate-600 border border-gray-200 px-5 py-2 text-xs font-bold font-mono tracking-wider uppercase rounded-lg shadow-2xs hover:shadow-xs transition-all flex items-center gap-1.5"
                >
                    <HiOutlineArrowPath className="h-3.5 w-3.5 stroke-[2.5]" />
                    Reset
                </button>
            </div>
        </div>
    );
};

export default FilterBar;
