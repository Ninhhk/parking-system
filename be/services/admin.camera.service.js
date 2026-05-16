const cameraRepo = require("../repositories/admin.camera.repo");
const { PROCESSING_MODULES, CAMERA_OFFLINE_THRESHOLD_SECONDS } = require("../config/constants");
const gatewayConfig = require("../config/edge_gateways.json");

// Build a Set of valid lane IDs from gateway config
const validLaneIds = new Set();
for (const gw of gatewayConfig.gateways) {
    for (const lane of gw.lanes) {
        validLaneIds.add(lane.lane_id);
    }
}

function computeStatus(camera) {
    if (!camera.is_active) return "disabled";
    if (!camera.last_heartbeat_at) return "offline";
    const ageSeconds = (Date.now() - new Date(camera.last_heartbeat_at).getTime()) / 1000;
    return ageSeconds <= CAMERA_OFFLINE_THRESHOLD_SECONDS ? "online" : "offline";
}

function validateCameraFields({ camera_name, lane_id, direction, purpose, stream_url }, isCreate = true) {
    const errors = [];

    if (isCreate || camera_name !== undefined) {
        if (!camera_name || typeof camera_name !== "string" || camera_name.trim().length === 0) {
            errors.push("camera_name is required (1-100 characters)");
        } else if (camera_name.length > 100) {
            errors.push("camera_name must be at most 100 characters");
        }
    }

    if (isCreate || lane_id !== undefined) {
        if (!lane_id || typeof lane_id !== "string") {
            errors.push("lane_id is required");
        } else if (!validLaneIds.has(lane_id)) {
            errors.push(`Lane '${lane_id}' is not recognized`);
        }
    }

    if (isCreate || direction !== undefined) {
        if (!direction || !["ENTRY", "EXIT"].includes(direction)) {
            errors.push("direction must be 'ENTRY' or 'EXIT'");
        }
    }

    if (isCreate || purpose !== undefined) {
        if (!purpose || !["plate", "overview"].includes(purpose)) {
            errors.push("purpose must be 'plate' or 'overview'");
        }
    }

    if (stream_url !== undefined && stream_url !== null) {
        if (typeof stream_url !== "string" || stream_url.length > 500) {
            errors.push("stream_url must be a string of at most 500 characters");
        }
    }

    return errors;
}

function createError(statusCode, message) {
    const err = new Error(message);
    err.statusCode = statusCode;
    return err;
}

exports.listCameras = async () => {
    return cameraRepo.findAll();
};

exports.createCamera = async ({ camera_name, lane_id, direction, purpose, stream_url }) => {
    const errors = validateCameraFields({ camera_name, lane_id, direction, purpose, stream_url }, true);
    if (errors.length > 0) {
        throw createError(422, errors[0]);
    }

    try {
        return await cameraRepo.create({ camera_name, lane_id, direction, purpose, stream_url });
    } catch (err) {
        if (err.code === "23505") {
            throw createError(409, `Conflict: an active camera with this lane/direction/purpose already exists`);
        }
        throw err;
    }
};

exports.getCameraById = async (cameraId) => {
    const camera = await cameraRepo.findById(cameraId);
    if (!camera) {
        throw createError(404, "Camera not found");
    }
    return camera;
};

exports.updateCamera = async (cameraId, updates) => {
    const camera = await cameraRepo.findById(cameraId);
    if (!camera) {
        throw createError(404, "Camera not found");
    }

    const errors = validateCameraFields(updates, false);
    if (errors.length > 0) {
        throw createError(422, errors[0]);
    }

    try {
        return await cameraRepo.update(cameraId, updates);
    } catch (err) {
        if (err.code === "23505") {
            throw createError(409, `Conflict: an active camera with this lane/direction/purpose already exists`);
        }
        throw err;
    }
};

exports.deleteCamera = async (cameraId) => {
    const camera = await cameraRepo.findById(cameraId);
    if (!camera) {
        throw createError(404, "Camera not found");
    }

    try {
        return await cameraRepo.remove(cameraId);
    } catch (err) {
        throw createError(500, "Failed to delete camera");
    }
};

exports.getCameraStatus = async () => {
    const cameras = await cameraRepo.findAllWithStatus();
    return cameras.map((cam) => ({
        camera_id: cam.camera_id,
        camera_name: cam.camera_name,
        is_active: cam.is_active,
        last_heartbeat_at: cam.last_heartbeat_at,
        status: computeStatus(cam),
    }));
};

exports.enableModule = async (cameraId, moduleType, configJson) => {
    const camera = await cameraRepo.findById(cameraId);
    if (!camera) {
        throw createError(404, "Camera not found");
    }

    if (!PROCESSING_MODULES.includes(moduleType)) {
        throw createError(422, `Invalid module_type. Valid types: ${PROCESSING_MODULES.join(", ")}`);
    }

    try {
        return await cameraRepo.createModuleAssignment(cameraId, moduleType, configJson);
    } catch (err) {
        if (err.code === "23505") {
            throw createError(409, `Module '${moduleType}' is already enabled for this camera`);
        }
        throw err;
    }
};

exports.disableModule = async (cameraId, moduleType) => {
    const camera = await cameraRepo.findById(cameraId);
    if (!camera) {
        throw createError(404, "Camera not found");
    }

    if (!PROCESSING_MODULES.includes(moduleType)) {
        throw createError(422, `Invalid module_type. Valid types: ${PROCESSING_MODULES.join(", ")}`);
    }

    const removed = await cameraRepo.removeModuleAssignment(cameraId, moduleType);
    if (!removed) {
        throw createError(404, `Module '${moduleType}' is not assigned to this camera`);
    }
    return removed;
};

exports.getEnabledModules = async (cameraId) => {
    return cameraRepo.findEnabledModules(cameraId);
};

exports.getActivePlateCamera = async (laneId, direction) => {
    return cameraRepo.findActivePlateCameraByLane(laneId, direction);
};

exports.updateHeartbeat = async (cameraId) => {
    return cameraRepo.updateHeartbeat(cameraId);
};
