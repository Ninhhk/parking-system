"use client";

import { useMemo, useState } from "react";
import { checkInByRfid } from "@/app/api/employee.client";
import { getRfidKioskFlags } from "./flags";
import {
    buildRfidKioskModuleRegistry,
    getMissingRequiredModules,
    RFID_KIOSK_MODULES,
} from "./modules";
import { KIOSK_STATES, getKioskStatusMessage, mapApiStatusToKioskState } from "./state";
import ReaderPanel from "./components/ReaderPanel";
import VehicleFormPanel from "./components/VehicleFormPanel";
import ResultPanel from "./components/ResultPanel";
import GateStatusPanel from "./components/GateStatusPanel";
import RecentEventsPanel from "./components/RecentEventsPanel";

export default function RfidKioskPage() {
    const flags = useMemo(() => getRfidKioskFlags(), []);
    const registry = useMemo(() => buildRfidKioskModuleRegistry(flags), [flags]);
    const missingRequiredModules = useMemo(() => getMissingRequiredModules(registry), [registry]);

    const [kioskState, setKioskState] = useState(KIOSK_STATES.IDLE);
    const [form, setForm] = useState({
        card_uid: "",
        vehicle_type: "car",
    });
    const [resultDetail, setResultDetail] = useState("");
    const [ticket, setTicket] = useState(null);
    const [events, setEvents] = useState([]);

    if (missingRequiredModules.length > 0) {
        return (
            <main className="mx-auto max-w-4xl p-6">
                <h1 className="text-2xl font-bold text-slate-900">RFID kiosk configuration error</h1>
                <p className="mt-2 text-slate-700">Missing required modules: {missingRequiredModules.join(", ")}.</p>
            </main>
        );
    }

    const isScanning = kioskState === KIOSK_STATES.SCANNING;
    const normalizedCardUid = form.card_uid.trim();
    const isSubmitDisabled = isScanning || normalizedCardUid.length === 0;

    const handleChange = (event) => {
        const { name, value } = event.target;
        setForm((previous) => ({
            ...previous,
            [name]: value,
        }));
    };

    const addEvent = (text) => {
        setEvents((previous) => [
            {
                id: `${Date.now()}-${Math.random()}`,
                text,
            },
            ...previous,
        ]);
    };

    const handleSubmit = async () => {
        if (isScanning) {
            return;
        }

        const cardUid = form.card_uid.trim();
        if (!cardUid) {
            setKioskState(KIOSK_STATES.ERROR);
            setResultDetail("RFID card UID is required");
            return;
        }

        setKioskState(KIOSK_STATES.SCANNING);
        setResultDetail("");
        setTicket(null);

        try {
            const response = await checkInByRfid({
                card_uid: cardUid,
                vehicle_type: form.vehicle_type,
            });

            setKioskState(KIOSK_STATES.SUCCESS);
            setTicket(response.ticket || null);
            const successText = `Success: ${cardUid}`;
            setResultDetail(successText);
            addEvent(`Entry recorded for ${cardUid}`);
        } catch (error) {
            const statusCode = error?.response?.status;
            const mappedState = mapApiStatusToKioskState(statusCode);
            setKioskState(mappedState);

            const message = error?.response?.data?.message || "RFID check-in failed";
            setResultDetail(message);
            addEvent(`Entry failed for ${cardUid}`);
        }
    };

    const showReader = registry[RFID_KIOSK_MODULES.READER]?.enabled;
    const showVehicleForm = registry[RFID_KIOSK_MODULES.VEHICLE_FORM]?.enabled;
    const showResult = registry[RFID_KIOSK_MODULES.RESULT]?.enabled;
    const showGateStatus = registry[RFID_KIOSK_MODULES.GATE_STATUS]?.enabled;
    const showRecentEvents = registry[RFID_KIOSK_MODULES.RECENT_EVENTS]?.enabled;

    return (
        <main className="mx-auto max-w-4xl space-y-4 p-6">
            <h1 className="text-2xl font-bold text-slate-900">RFID Check-in Kiosk</h1>

            {showReader ? <ReaderPanel value={form.card_uid} onChange={handleChange} disabled={isScanning} /> : null}

            {showVehicleForm ? (
                <VehicleFormPanel
                    value={form.vehicle_type}
                    onChange={handleChange}
                    disabled={isSubmitDisabled}
                    onSubmit={handleSubmit}
                />
            ) : null}

            {showResult ? (
                <ResultPanel
                    stateLabel={getKioskStatusMessage(kioskState)}
                    detail={resultDetail}
                    sessionId={ticket?.session_id}
                />
            ) : null}

            {showGateStatus ? <GateStatusPanel isOpen={kioskState === KIOSK_STATES.SUCCESS} /> : null}

            {showRecentEvents ? <RecentEventsPanel events={events} /> : null}
        </main>
    );
}
