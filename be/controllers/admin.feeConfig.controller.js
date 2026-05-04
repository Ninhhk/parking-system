const feeRepo = require('../repositories/admin.feeConfig.repo');
const adminFeeConfigService = require('../services/admin.feeConfig.service');

const getAllFeeConfigs = async (req, res) => {
    try {
        const feeConfigs = await feeRepo.getAllFeeConfigs();
        //console.log('All fee configurations:', feeConfigs);
        res.status(200).json({
            success: true,
            data: feeConfigs
        });
    } catch (error) {
        console.error('Get all fee configurations error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
}

const setServiceFee = async (req, res) => {
    try {
        const { ticket_type, vehicle_type, service_fee, penalty_fee } = req.body;

        // Validate required fields
        if (!ticket_type || !vehicle_type || service_fee == null || penalty_fee == null) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields'
            });
        }

        const existingFee = await feeRepo.getServiceFee(ticket_type, vehicle_type);
        let result;
        if (existingFee) {
            result = await feeRepo.setServiceFee(ticket_type, vehicle_type, service_fee, penalty_fee);
        } else {
            result = await feeRepo.createServiceFee(ticket_type, vehicle_type, service_fee, penalty_fee);
        }

        res.status(200).json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('Set service fee error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

const listVersions = async (req, res) => {
    try {
        const data = await adminFeeConfigService.getFeeConfigVersions(req.query.vehicle_type);
        res.status(200).json({ success: true, data });
    } catch (error) {
        console.error("List fee config versions error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

const getActive = async (req, res) => {
    try {
        const data = await adminFeeConfigService.getActiveFeeConfigs();
        res.status(200).json({ success: true, data });
    } catch (error) {
        console.error("Get active fee configs error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

const createVersion = async (req, res) => {
    try {
        const created = await adminFeeConfigService.createFeeConfigVersion(req.body, req.session.user.user_id);
        res.status(201).json({ success: true, data: created });
    } catch (error) {
        if (error.status === 422) {
            return res.status(422).json({ success: false, message: "Validation failed", fields: error.fields });
        }
        console.error("Create fee config version error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

module.exports = {
    setServiceFee,
    getAllFeeConfigs,
    listVersions,
    getActive,
    createVersion,
};