const { getState, setState } = require("../services/gate.state.service");

const getGateState = (req, res) => {
    const { laneId } = req.params;
    const state = getState(laneId);
    res.json(state);
};

const setGateState = (req, res) => {
    const { laneId } = req.params;
    const { status, plate, message } = req.body;
    if (!status || !["OPEN", "CLOSED"].includes(status)) {
        return res.status(422).json({ success: false, message: "status must be OPEN or CLOSED" });
    }
    const state = setState(laneId, { status, plate, message });
    res.json(state);
};

module.exports = { getState: getGateState, setState: setGateState };
