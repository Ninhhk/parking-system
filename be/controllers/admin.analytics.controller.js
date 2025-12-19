const analyticsService = require('../services/admin.analytics.service');

// Get overall statistics
exports.getOverallStats = async (req, res) => {
    try {
        const data = await analyticsService.getOverallStats();
        
        res.status(200).json({
            success: true,
            data
        });
    } catch (error) {
        console.error('Get overall stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Get revenue data by time range
exports.getRevenueData = async (req, res) => {
    try {
        const { timeRange } = req.query; // weekly, monthly, yearly
        
        const data = await analyticsService.getRevenueData(timeRange);
        
        res.status(200).json({
            success: true,
            data
        });
    } catch (error) {
        console.error('Get revenue data error:', error);
        
        if (error.message.includes('Invalid time range')) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
        
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Get parking lot occupancy data
exports.getParkingLotOccupancy = async (req, res) => {
    try {
        const data = await analyticsService.getParkingLotOccupancy();
        
        res.status(200).json({
            success: true,
            data
        });
    } catch (error) {
        console.error('Get parking lot occupancy error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Get popular parking times
exports.getPopularTimes = async (req, res) => {
    try {
        const data = await analyticsService.getPopularTimes();
        
        res.status(200).json({
            success: true,
            data
        });
    } catch (error) {
        console.error('Get popular times error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Get vehicle usage data
exports.getVehicleUsage = async (req, res) => {
    try {
        const data = await analyticsService.getVehicleUsage();
        
        res.status(200).json({
            success: true,
            data
        });
    } catch (error) {
        console.error('Get vehicle usage error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Get parking duration distribution
exports.getParkingDuration = async (req, res) => {
    try {
        const data = await analyticsService.getParkingDuration();
        
        res.status(200).json({
            success: true,
            data
        });
    } catch (error) {
        console.error('Get parking duration error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};
