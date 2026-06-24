const { getState } = require("../services/gate.state.service");

const getGateState = (req, res) => {
    const { laneId } = req.params;
    const state = getState(laneId);
    res.json(state);
};

module.exports = { getState: getGateState };
