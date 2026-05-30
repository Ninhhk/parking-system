const { pool } = require("../config/db");

exports.findAll = async (client = pool) => {
    const result = await client.query(
        `SELECT camera_id, camera_name, lane_id, direction, purpose,
                stream_url, is_active, last_heartbeat_at, created_at, updated_at
         FROM cameras
         ORDER BY created_at DESC`
    );
    return result.rows;
};

exports.findById = async (cameraId, client = pool) => {
    const result = await client.query(
        `SELECT camera_id, camera_name, lane_id, direction, purpose,
                stream_url, is_active, last_heartbeat_at, created_at, updated_at
         FROM cameras
         WHERE camera_id = $1`,
        [cameraId]
    );
    return result.rows[0] || null;
};

exports.create = async (data, client = pool) => {
    const { camera_name, lane_id, direction, purpose, stream_url } = data;
    const result = await client.query(
        `INSERT INTO cameras (camera_name, lane_id, direction, purpose, stream_url)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [camera_name, lane_id, direction, purpose, stream_url || null]
    );
    return result.rows[0];
};

exports.update = async (cameraId, data, client = pool) => {
    const fields = [];
    const params = [];
    let idx = 1;

    const allowedFields = ["camera_name", "lane_id", "direction", "purpose", "stream_url", "is_active"];
    for (const field of allowedFields) {
        if (data[field] !== undefined) {
            fields.push(`${field} = $${idx}`);
            params.push(data[field]);
            idx++;
        }
    }

    if (fields.length === 0) return exports.findById(cameraId, client);

    fields.push(`updated_at = NOW()`);
    params.push(cameraId);

    const result = await client.query(
        `UPDATE cameras
         SET ${fields.join(", ")}
         WHERE camera_id = $${idx}
         RETURNING *`,
        params
    );
    return result.rows[0] || null;
};

exports.remove = async (cameraId, client = pool) => {
    const result = await client.query(
        `DELETE FROM cameras
         WHERE camera_id = $1
         RETURNING *`,
        [cameraId]
    );
    return result.rows[0] || null;
};

exports.findAllWithStatus = async (client = pool) => {
    const result = await client.query(
        `SELECT camera_id, camera_name, lane_id, direction, purpose,
                stream_url, is_active, last_heartbeat_at, created_at, updated_at
         FROM cameras
         ORDER BY created_at DESC`
    );
    return result.rows;
};

exports.findActivePlateCameraByLane = async (laneId, direction, client = pool) => {
    const result = await client.query(
        `SELECT camera_id, camera_name, lane_id, direction, purpose,
                stream_url, is_active, last_heartbeat_at, created_at, updated_at
         FROM cameras
         WHERE lane_id = $1
           AND direction = $2
           AND purpose = 'plate'
           AND is_active = true
         LIMIT 1`,
        [laneId, direction]
    );
    return result.rows[0] || null;
};

exports.updateHeartbeat = async (cameraId, client = pool) => {
    const result = await client.query(
        `UPDATE cameras
         SET last_heartbeat_at = NOW()
         WHERE camera_id = $1
         RETURNING *`,
        [cameraId]
    );
    return result.rows[0] || null;
};

// --- Module assignment methods ---

exports.findModulesByCameraId = async (cameraId, client = pool) => {
    const result = await client.query(
        `SELECT camera_id, module_type, is_enabled, config_json, created_at
         FROM camera_module_assignments
         WHERE camera_id = $1
         ORDER BY module_type`,
        [cameraId]
    );
    return result.rows;
};

exports.createModuleAssignment = async (cameraId, moduleType, configJson, client = pool) => {
    const result = await client.query(
        `INSERT INTO camera_module_assignments (camera_id, module_type, config_json)
         VALUES ($1, $2, $3::jsonb)
         RETURNING *`,
        [cameraId, moduleType, JSON.stringify(configJson || {})]
    );
    return result.rows[0];
};

exports.removeModuleAssignment = async (cameraId, moduleType, client = pool) => {
    const result = await client.query(
        `DELETE FROM camera_module_assignments
         WHERE camera_id = $1
           AND module_type = $2
         RETURNING *`,
        [cameraId, moduleType]
    );
    return result.rows[0] || null;
};

exports.findEnabledModules = async (cameraId, client = pool) => {
    const result = await client.query(
        `SELECT camera_id, module_type, is_enabled, config_json, created_at
         FROM camera_module_assignments
         WHERE camera_id = $1
           AND is_enabled = true
         ORDER BY module_type`,
        [cameraId]
    );
    return result.rows;
};
