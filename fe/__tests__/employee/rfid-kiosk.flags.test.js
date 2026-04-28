import { getRfidKioskFlags } from "@/app/employee/checkin/rfid/flags";
import {
    REQUIRED_MODULES,
    RFID_KIOSK_MODULES,
    buildRfidKioskModuleRegistry,
    getMissingRequiredModules,
} from "@/app/employee/checkin/rfid/modules";
import {
    KIOSK_STATES,
    getKioskStatusMessage,
    mapApiStatusToKioskState,
} from "@/app/employee/checkin/rfid/state";

describe("rfid kiosk utility modules", () => {
    it("getRfidKioskFlags returns expected defaults", () => {
        const flags = getRfidKioskFlags({});

        expect(flags).toEqual({
            READER: true,
            VEHICLE_FORM: true,
            RESULT: true,
            GATE_STATUS: true,
            RECENT_EVENTS: false,
        });
    });

    it("getRfidKioskFlags parses false values from environment", () => {
        const flags = getRfidKioskFlags({
            NEXT_PUBLIC_KIOSK_MODULE_READER: "false",
            NEXT_PUBLIC_KIOSK_MODULE_VEHICLE_FORM: "0",
            NEXT_PUBLIC_KIOSK_MODULE_RESULT: "no",
            NEXT_PUBLIC_KIOSK_MODULE_GATE_STATUS: "off",
            NEXT_PUBLIC_KIOSK_MODULE_RECENT_EVENTS: "false",
        });

        expect(flags).toEqual({
            READER: false,
            VEHICLE_FORM: false,
            RESULT: false,
            GATE_STATUS: false,
            RECENT_EVENTS: false,
        });
    });

    it("buildRfidKioskModuleRegistry marks required modules and missing required modules", () => {
        const registry = buildRfidKioskModuleRegistry({
            READER: true,
            VEHICLE_FORM: false,
            RESULT: true,
            GATE_STATUS: false,
            RECENT_EVENTS: false,
        });

        expect(REQUIRED_MODULES).toEqual([
            RFID_KIOSK_MODULES.READER,
            RFID_KIOSK_MODULES.VEHICLE_FORM,
            RFID_KIOSK_MODULES.RESULT,
        ]);

        expect(registry.READER).toEqual({ enabled: true, required: true });
        expect(registry.VEHICLE_FORM).toEqual({ enabled: false, required: true });
        expect(registry.RESULT).toEqual({ enabled: true, required: true });
        expect(registry.GATE_STATUS).toEqual({ enabled: false, required: false });

        expect(getMissingRequiredModules(registry)).toEqual([
            RFID_KIOSK_MODULES.VEHICLE_FORM,
        ]);
    });

    it("getKioskStatusMessage maps known and unknown states", () => {
        expect(KIOSK_STATES).toEqual({
            IDLE: "idle",
            SCANNING: "scanning",
            SUCCESS: "success",
            DENIED: "denied",
            ERROR: "error",
        });

        expect(getKioskStatusMessage(KIOSK_STATES.IDLE)).toBe("Ready to scan");
        expect(getKioskStatusMessage(KIOSK_STATES.SCANNING)).toBe("Scanning card...");
        expect(getKioskStatusMessage(KIOSK_STATES.SUCCESS)).toBe("Access granted");
        expect(getKioskStatusMessage(KIOSK_STATES.DENIED)).toBe("Access denied");
        expect(getKioskStatusMessage(KIOSK_STATES.ERROR)).toBe("System error");
        expect(getKioskStatusMessage("unknown")).toBe("Unknown status");
    });

    it("mapApiStatusToKioskState maps API status codes", () => {
        expect(mapApiStatusToKioskState(201)).toBe(KIOSK_STATES.SUCCESS);
        expect(mapApiStatusToKioskState(409)).toBe(KIOSK_STATES.DENIED);

        expect(mapApiStatusToKioskState(422)).toBe(KIOSK_STATES.ERROR);
        expect(mapApiStatusToKioskState(404)).toBe(KIOSK_STATES.ERROR);
        expect(mapApiStatusToKioskState(500)).toBe(KIOSK_STATES.ERROR);
        expect(mapApiStatusToKioskState(418)).toBe(KIOSK_STATES.ERROR);
        expect(mapApiStatusToKioskState(undefined)).toBe(KIOSK_STATES.ERROR);
    });
});
