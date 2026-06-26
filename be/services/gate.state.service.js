const gateStates = new Map();
const resetTimers = new Map();
const RESET_DELAY_MS = 5000;

const defaultState = (laneId) => ({
    lane_id: laneId,
    status: "CLOSED",
    plate: "",
    message: "",
    updated_at: new Date().toISOString(),
});

const getState = (laneId) => {
    return gateStates.get(laneId) || defaultState(laneId);
};

const setState = (laneId, { status, plate, message }) => {
    if (resetTimers.has(laneId)) {
        clearTimeout(resetTimers.get(laneId));
    }
    const state = {
        lane_id: laneId,
        status,
        plate: plate || "",
        message: message || "",
        updated_at: new Date().toISOString(),
    };
    gateStates.set(laneId, state);
    const timer = setTimeout(() => {
        gateStates.set(laneId, defaultState(laneId));
        resetTimers.delete(laneId);
    }, RESET_DELAY_MS);
    resetTimers.set(laneId, timer);
    return state;
};

module.exports = { getState, setState, defaultState };
