const monitorRepo = require('../repositories/employee.monitor.repo');

exports.getMyLot = async (req, res) => {
    try {
        const user_id = req.session.user.user_id;
        const parkingLot = await monitorRepo.getMyLot(user_id);
        
        if (!parkingLot) {
            return res.status(404).json({
                success: false,
                message: 'Parking lot not found'
            });
        }

        res.status(200).json({
            success: true,
            data: parkingLot
        });
    } catch (error) {
        console.error('Get parking lot error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
}

exports.getMyParkingSessions = async (req, res) => {
    try {
        const user_id = req.session.user.user_id;
        const parkingSessions = await monitorRepo.getMyParkingSessions(user_id);

        if (!parkingSessions) {
            return res.status(404).json({
                success: false,
                message: 'Parking sessions not found'
            });
        }

        res.status(200).json({
            success: true,
            data: parkingSessions
        });
    } catch (error) {
        console.error('Get parking sessions error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
}