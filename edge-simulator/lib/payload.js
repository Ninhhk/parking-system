const { v4: uuidv4 } = require("uuid");
const fs = require("fs");
const path = require("path");

const buildPayload = (scenario) => {
    const payload = {
        event_id: uuidv4(),
        gateway_id: scenario.gateway_id,
        lane_id: scenario.lane_id,
        lot_id: scenario.lot_id,
        vehicle_type: scenario.vehicle_type,
        occurred_at: new Date().toISOString(),
        trigger: {
            type: scenario.trigger_type,
            value: scenario.trigger_value || "",
        },
    };

    if (scenario.trigger_type === "LPD") {
        payload.trigger.plate = scenario.plate || "";
        if (scenario.image_path) {
            const absPath = path.resolve(__dirname, "..", scenario.image_path);
            const imageData = fs.readFileSync(absPath);
            payload.trigger.image_base64 = imageData.toString("base64");
        }
    }

    return payload;
};

module.exports = { buildPayload };
