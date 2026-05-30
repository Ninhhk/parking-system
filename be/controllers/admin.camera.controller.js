const cameraService = require("../services/admin.camera.service");
const gatewayConfig = require("../config/edge_gateways.json");

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUUID(value) {
    return typeof value === "string" && UUID_REGEX.test(value);
}

function handleServiceError(res, err) {
    const status = err.statusCode || 500;
    const message = err.statusCode ? err.message : "Internal server error";
    return res.status(status).json({ success: false, message });
}

exports.listCameras = async (req, res) => {
    try {
        const cameras = await cameraService.listCameras();
        return res.status(200).json({ success: true, data: cameras });
    } catch (err) {
        return handleServiceError(res, err);
    }
};

exports.getAvailableLanes = (req, res) => {
    const lanes = [];
    for (const gw of gatewayConfig.gateways) {
        for (const lane of gw.lanes) {
            lanes.push({
                lane_id: lane.lane_id,
                lane_direction: lane.lane_direction,
                gateway_id: gw.gateway_id,
            });
        }
    }
    return res.status(200).json({ success: true, data: lanes });
};

exports.createCamera = async (req, res) => {
    const { camera_name, lane_id, direction, purpose, stream_url } = req.body;

    if (!camera_name || typeof camera_name !== "string" || camera_name.trim().length === 0) {
        return res.status(422).json({ success: false, message: "camera_name is required" });
    }
    if (!lane_id || typeof lane_id !== "string") {
        return res.status(422).json({ success: false, message: "lane_id is required" });
    }
    if (!direction || !["ENTRY", "EXIT"].includes(direction)) {
        return res.status(422).json({ success: false, message: "direction must be 'ENTRY' or 'EXIT'" });
    }
    if (!purpose || !["plate", "overview"].includes(purpose)) {
        return res.status(422).json({ success: false, message: "purpose must be 'plate' or 'overview'" });
    }

    try {
        const camera = await cameraService.createCamera({ camera_name, lane_id, direction, purpose, stream_url });
        return res.status(201).json({ success: true, data: camera });
    } catch (err) {
        return handleServiceError(res, err);
    }
};

exports.getCameraById = async (req, res) => {
    const { camera_id } = req.params;

    if (!camera_id || !isValidUUID(camera_id)) {
        return res.status(422).json({ success: false, message: "camera_id must be a valid UUID" });
    }

    try {
        const camera = await cameraService.getCameraById(camera_id);
        return res.status(200).json({ success: true, data: camera });
    } catch (err) {
        return handleServiceError(res, err);
    }
};

exports.updateCamera = async (req, res) => {
    const { camera_id } = req.params;

    if (!camera_id || !isValidUUID(camera_id)) {
        return res.status(422).json({ success: false, message: "camera_id must be a valid UUID" });
    }

    try {
        const camera = await cameraService.updateCamera(camera_id, req.body);
        return res.status(200).json({ success: true, data: camera });
    } catch (err) {
        return handleServiceError(res, err);
    }
};

exports.deleteCamera = async (req, res) => {
    const { camera_id } = req.params;

    if (!camera_id || !isValidUUID(camera_id)) {
        return res.status(422).json({ success: false, message: "camera_id must be a valid UUID" });
    }

    try {
        await cameraService.deleteCamera(camera_id);
        return res.status(200).json({ success: true, data: { deleted: true } });
    } catch (err) {
        return handleServiceError(res, err);
    }
};

exports.getCameraStatus = async (req, res) => {
    try {
        const statuses = await cameraService.getCameraStatus();
        return res.status(200).json({ success: true, data: statuses });
    } catch (err) {
        return handleServiceError(res, err);
    }
};

exports.enableModule = async (req, res) => {
    const { camera_id } = req.params;
    const { module_type, config_json } = req.body;

    if (!camera_id || !isValidUUID(camera_id)) {
        return res.status(422).json({ success: false, message: "camera_id must be a valid UUID" });
    }
    if (!module_type || typeof module_type !== "string") {
        return res.status(422).json({ success: false, message: "module_type is required" });
    }

    try {
        const assignment = await cameraService.enableModule(camera_id, module_type, config_json || {});
        return res.status(201).json({ success: true, data: assignment });
    } catch (err) {
        return handleServiceError(res, err);
    }
};

exports.disableModule = async (req, res) => {
    const { camera_id, module_type } = req.params;

    if (!camera_id || !isValidUUID(camera_id)) {
        return res.status(422).json({ success: false, message: "camera_id must be a valid UUID" });
    }
    if (!module_type || typeof module_type !== "string") {
        return res.status(422).json({ success: false, message: "module_type is required" });
    }

    try {
        await cameraService.disableModule(camera_id, module_type);
        return res.status(200).json({ success: true, data: { disabled: true } });
    } catch (err) {
        return handleServiceError(res, err);
    }
};
