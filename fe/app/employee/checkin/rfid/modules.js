export const RFID_KIOSK_MODULES = {
    READER: "READER",
    VEHICLE_FORM: "VEHICLE_FORM",
    RESULT: "RESULT",
    GATE_STATUS: "GATE_STATUS",
    RECENT_EVENTS: "RECENT_EVENTS",
};

export const REQUIRED_MODULES = [
    RFID_KIOSK_MODULES.READER,
    RFID_KIOSK_MODULES.VEHICLE_FORM,
    RFID_KIOSK_MODULES.RESULT,
];

export function buildRfidKioskModuleRegistry(flags = {}) {
    return Object.values(RFID_KIOSK_MODULES).reduce((registry, moduleKey) => {
        registry[moduleKey] = {
            enabled: Boolean(flags[moduleKey]),
            required: REQUIRED_MODULES.includes(moduleKey),
        };
        return registry;
    }, {});
}

export function getMissingRequiredModules(registry = {}) {
    return REQUIRED_MODULES.filter((moduleKey) => !registry[moduleKey]?.enabled);
}
