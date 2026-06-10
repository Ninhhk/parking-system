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

        // LPD is "active" for this lane only when the lane policy permits it AND
        // an active plate camera on the lane/direction has the LPD module enabled
        // in admin (camera_module_assignments). This keeps the kiosk badge in sync
        // with the admin Camera Management config instead of the static lane policy.
        const laneAllowsLpd = Array.isArray(lane.allowed_trigger_modules) &&
            lane.allowed_trigger_modules.some((m) => String(m).toUpperCase() === "LPD");

        let lpdEnabled = false;
        if (laneAllowsLpd) {
            const lpdCameraResult = await pool.query(
                `SELECT 1
                   FROM cameras c
                   JOIN camera_module_assignments m ON m.camera_id = c.camera_id
                  WHERE c.lane_id = $1
                    AND c.direction = $2
                    AND c.purpose = 'plate'
                    AND c.is_active = true
                    AND m.module_type = 'LPD'
                    AND m.is_enabled = true
                  LIMIT 1`,
                [lane_id, lane.lane_direction]
            );
            lpdEnabled = lpdCameraResult.rowCount > 0;
        }

        return res.status(200).json({
            success: true,
            data: {
                lane_id: lane.lane_id,
                lane_direction: lane.lane_direction,
                allowed_trigger_modules: lane.allowed_trigger_modules,
                has_camera: cameraResult.rowCount > 0,
                lpd_enabled: lpdEnabled,
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
