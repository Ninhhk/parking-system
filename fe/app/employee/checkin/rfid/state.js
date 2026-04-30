export const KIOSK_STATES = {
    IDLE: "idle",
    SCANNING: "scanning",
    SUCCESS: "success",
    DENIED: "denied",
    ERROR: "error",
};

const STATUS_MESSAGES = {
    [KIOSK_STATES.IDLE]: "Ready to scan",
    [KIOSK_STATES.SCANNING]: "Scanning card...",
    [KIOSK_STATES.SUCCESS]: "Access granted",
    [KIOSK_STATES.DENIED]: "Access denied",
    [KIOSK_STATES.ERROR]: "System error",
};

export function getKioskStatusMessage(state) {
    return STATUS_MESSAGES[state] || "Unknown status";
}

export function mapApiStatusToKioskState(apiStatus) {
    if (apiStatus === 201) {
        return KIOSK_STATES.SUCCESS;
    }

    if (apiStatus === 409) {
        return KIOSK_STATES.DENIED;
    }

    return KIOSK_STATES.ERROR;
}
