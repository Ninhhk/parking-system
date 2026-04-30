const FALSE_VALUES = new Set(["0", "false", "no", "off"]);
const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);

export const RFID_KIOSK_FLAG_ENV_KEYS = {
    READER: "NEXT_PUBLIC_KIOSK_MODULE_READER",
    VEHICLE_FORM: "NEXT_PUBLIC_KIOSK_MODULE_VEHICLE_FORM",
    RESULT: "NEXT_PUBLIC_KIOSK_MODULE_RESULT",
    GATE_STATUS: "NEXT_PUBLIC_KIOSK_MODULE_GATE_STATUS",
    RECENT_EVENTS: "NEXT_PUBLIC_KIOSK_MODULE_RECENT_EVENTS",
};

export const RFID_KIOSK_FLAG_DEFAULTS = {
    READER: true,
    VEHICLE_FORM: true,
    RESULT: true,
    GATE_STATUS: true,
    RECENT_EVENTS: false,
};

function parseBooleanFlag(value, defaultValue) {
    if (value == null) {
        return defaultValue;
    }

    const normalized = String(value).trim().toLowerCase();

    if (FALSE_VALUES.has(normalized)) {
        return false;
    }

    if (TRUE_VALUES.has(normalized)) {
        return true;
    }

    return defaultValue;
}

export function getRfidKioskFlags(env = process.env) {
    return {
        READER: parseBooleanFlag(
            env[RFID_KIOSK_FLAG_ENV_KEYS.READER],
            RFID_KIOSK_FLAG_DEFAULTS.READER,
        ),
        VEHICLE_FORM: parseBooleanFlag(
            env[RFID_KIOSK_FLAG_ENV_KEYS.VEHICLE_FORM],
            RFID_KIOSK_FLAG_DEFAULTS.VEHICLE_FORM,
        ),
        RESULT: parseBooleanFlag(
            env[RFID_KIOSK_FLAG_ENV_KEYS.RESULT],
            RFID_KIOSK_FLAG_DEFAULTS.RESULT,
        ),
        GATE_STATUS: parseBooleanFlag(
            env[RFID_KIOSK_FLAG_ENV_KEYS.GATE_STATUS],
            RFID_KIOSK_FLAG_DEFAULTS.GATE_STATUS,
        ),
        RECENT_EVENTS: parseBooleanFlag(
            env[RFID_KIOSK_FLAG_ENV_KEYS.RECENT_EVENTS],
            RFID_KIOSK_FLAG_DEFAULTS.RECENT_EVENTS,
        ),
    };
}
