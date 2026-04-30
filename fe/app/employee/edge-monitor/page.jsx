"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FaSync } from "react-icons/fa";

import {
    fetchEdgeActiveSessions,
    fetchEdgeEvents,
    retryEdgeEvent,
} from "../../api/edge.client";
import { useToast } from "../../components/providers/ToastProvider";
import { buildQueryFromFilters, parseFiltersFromSearch } from "./query";
import { createPollingRunner } from "./polling";

const POLL_MS = 10000;

const mapStatusClass = (status) => {
    const normalized = String(status || "").toUpperCase();
    if (normalized === "SUCCESS") return "bg-green-100 text-green-700";
    if (normalized === "FAILED") return "bg-red-100 text-red-700";
    if (normalized === "PROCESSING") return "bg-yellow-100 text-yellow-700";
    return "bg-gray-100 text-gray-700";
};

const formatDateTime = (value) => {
    if (!value) return "-";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString();
};

const extractRows = (payload) => {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.rows)) return payload.rows;
    if (Array.isArray(payload?.items)) return payload.items;
    return [];
};

function EdgeMonitorContent() {
    const toast = useToast();
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const searchString = searchParams?.toString() || "";

    const filters = useMemo(
        () => parseFiltersFromSearch(searchString),
        [searchString]
    );

    const [events, setEvents] = useState([]);
    const [activeSessions, setActiveSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [retryingId, setRetryingId] = useState("");
    const pollRunnerRef = useRef(null);
    const toastRef = useRef(toast);

    useEffect(() => {
        toastRef.current = toast;
    }, [toast]);

    const setFilters = useCallback(
        (nextFilters) => {
            const queryObj = buildQueryFromFilters(nextFilters);
            const queryString = new URLSearchParams(queryObj).toString();
            router.replace(queryString ? `${pathname}?${queryString}` : pathname);
        },
        [pathname, router]
    );

    const updateFilter = (key, value) => {
        setFilters({
            ...filters,
            [key]: value,
            page: key === "page" ? value : 1,
        });
    };

    const loadData = useCallback(
        async ({ silent = false } = {}) => {
            if (silent) {
                setRefreshing(true);
            } else {
                setLoading(true);
            }

            try {
                const [eventsPayload, sessionsPayload] = await Promise.all([
                    fetchEdgeEvents({
                        status: filters.status,
                        lane: filters.lane_id,
                        trigger: filters.trigger,
                        q: filters.q,
                        page: filters.page,
                    }),
                    fetchEdgeActiveSessions({
                        laneId: filters.lane_id,
                        q: filters.q,
                        page: filters.page,
                    }),
                ]);

                setEvents(extractRows(eventsPayload));
                setActiveSessions(extractRows(sessionsPayload));
            } catch (error) {
                toastRef.current.error(error.response?.data?.message || "Failed to load edge ops data");
            } finally {
                setLoading(false);
                setRefreshing(false);
            }
        },
        [filters]
    );

    useEffect(() => {
        pollRunnerRef.current = createPollingRunner(() => loadData({ silent: true }));
    }, [loadData]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    useEffect(() => {
        const timer = setInterval(() => {
            if (pollRunnerRef.current) {
                pollRunnerRef.current();
            }
        }, POLL_MS);

        return () => clearInterval(timer);
    }, [loadData]);

    const handleRetry = async (eventId) => {
        setRetryingId(eventId);
        try {
            await retryEdgeEvent(eventId);
            toastRef.current.success("Retry triggered");
            await loadData({ silent: true });
        } catch (error) {
            toastRef.current.error(error.response?.data?.message || "Retry failed");
        } finally {
            setRetryingId("");
        }
    };

    return (
        <div className="p-6 bg-gray-100 min-h-screen space-y-6">
            <div className="bg-white rounded-lg shadow-sm p-4">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                    <h1 className="text-xl font-semibold text-gray-900">Edge Ops Console</h1>
                    <button
                        type="button"
                        onClick={() => loadData({ silent: true })}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-blue-600 text-white text-sm hover:bg-blue-700"
                    >
                        <FaSync className={refreshing ? "animate-spin" : ""} />
                        Refresh
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mt-4">
                    <select
                        value={filters.status}
                        onChange={(e) => updateFilter("status", e.target.value)}
                        className="border border-gray-300 rounded-md px-3 py-2 text-sm"
                    >
                        <option value="">All status</option>
                        <option value="FAILED">Failed</option>
                        <option value="PROCESSING">Processing</option>
                        <option value="SUCCESS">Success</option>
                    </select>

                    <input
                        type="text"
                        value={filters.lane_id}
                        onChange={(e) => updateFilter("lane_id", e.target.value)}
                        placeholder="Lane ID"
                        className="border border-gray-300 rounded-md px-3 py-2 text-sm"
                    />

                    <select
                        value={filters.trigger}
                        onChange={(e) => updateFilter("trigger", e.target.value)}
                        className="border border-gray-300 rounded-md px-3 py-2 text-sm"
                    >
                        <option value="">All triggers</option>
                        <option value="LPD">LPD</option>
                        <option value="MANUAL">Manual</option>
                        <option value="IC_CARD">IC Card</option>
                        <option value="UHF_TAG">UHF Tag</option>
                    </select>

                    <input
                        type="text"
                        value={filters.q}
                        onChange={(e) => updateFilter("q", e.target.value)}
                        placeholder="Search plate/tag/card"
                        className="border border-gray-300 rounded-md px-3 py-2 text-sm"
                    />

                    <input
                        type="number"
                        min="1"
                        value={filters.page}
                        onChange={(e) => updateFilter("page", Number(e.target.value) || 1)}
                        className="border border-gray-300 rounded-md px-3 py-2 text-sm"
                    />
                </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-200 font-medium text-gray-900">Edge Events</div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Event</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Lane</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Trigger</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Status</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Occurred</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                            {!loading && events.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-6 text-center text-sm text-gray-500">
                                        No events found
                                    </td>
                                </tr>
                            ) : (
                                events.map((event) => {
                                    const isFailed = String(event.status || "").toUpperCase() === "FAILED";
                                    return (
                                        <tr key={event.event_id}>
                                            <td className="px-4 py-3 text-sm text-gray-800">{event.event_id}</td>
                                            <td className="px-4 py-3 text-sm text-gray-600">{event.lane_id || "-"}</td>
                                            <td className="px-4 py-3 text-sm text-gray-600">
                                                {event.payload_json?.triggerType || "-"}
                                            </td>
                                            <td className="px-4 py-3 text-sm">
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${mapStatusClass(event.status)}`}>
                                                    {event.status || "UNKNOWN"}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-600">{formatDateTime(event.occurred_at)}</td>
                                            <td className="px-4 py-3 text-sm">
                                                <button
                                                    type="button"
                                                    disabled={!isFailed || retryingId === event.event_id}
                                                    onClick={() => handleRetry(event.event_id)}
                                                    className="px-3 py-1.5 rounded-md text-xs font-medium bg-red-600 text-white disabled:bg-gray-300 disabled:text-gray-500"
                                                >
                                                    {retryingId === event.event_id ? "Retrying..." : "Retry"}
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-200 font-medium text-gray-900">Active Sessions</div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Session</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Plate</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Vehicle</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Lane</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Time In</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                            {!loading && activeSessions.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-500">
                                        No active sessions found
                                    </td>
                                </tr>
                            ) : (
                                activeSessions.map((session) => (
                                    <tr key={session.session_id}>
                                        <td className="px-4 py-3 text-sm text-gray-800">{session.session_id}</td>
                                        <td className="px-4 py-3 text-sm text-gray-600">{session.license_plate || "-"}</td>
                                        <td className="px-4 py-3 text-sm text-gray-600">{session.vehicle_type || "-"}</td>
                                        <td className="px-4 py-3 text-sm text-gray-600">{session.entry_lane_id || "-"}</td>
                                        <td className="px-4 py-3 text-sm text-gray-600">{formatDateTime(session.time_in)}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

function EdgeMonitorLoading() {
    return <div className="p-6 text-sm text-gray-600">Loading edge ops...</div>;
}

export default function EdgeMonitorPage() {
    return (
        <Suspense fallback={<EdgeMonitorLoading />}>
            <EdgeMonitorContent />
        </Suspense>
    );
}
