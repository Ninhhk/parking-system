const { pool } = require("../config/db");
const gatewayConfig = require("../config/edge_gateways.json");

function findLane(laneId) {
    for (const gw of gatewayConfig.gateways) {
        for (const lane of gw.lanes) {
            if (lane.lane_id === laneId) {
                return lane;
            }
        }
    }
    return null;
}

exports.getLaneConfig = async (req, res) => {
    try {
        const { lane_id } = req.params;

        const lane = findLane(lane_id);
        if (!lane) {
            return res.status(404).json({
                success: false,
                message: "Lane not found",
            });
        }

        const cameraResult = await pool.query(
            "SELECT 1 FROM cameras WHERE lane_id = $1 AND direction = $2 AND is_active = true LIMIT 1",
            [lane_id, lane.lane_direction]
        );

        return res.status(200).json({
            success: true,
            data: {
                lane_id: lane.lane_id,
                lane_direction: lane.lane_direction,
                allowed_trigger_modules: lane.allowed_trigger_modules,
                has_camera: cameraResult.rowCount > 0,
                vehicle_type: lane.vehicle_type || null,
            },
        });
    } catch (error) {
        console.error("getLaneConfig error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};
