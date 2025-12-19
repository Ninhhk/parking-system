const { pool } = require('../config/db');

exports.getDashboard = async (req, res) => {
    try {
        res.status(200).json({
            success: true,
            data: {
                message: "Welcome to Admin Home",
                user: {
                    user_id : req.session.user.user_id,
                    username: req.session.user.username,
                    role: req.session.user.role,
                    full_name : req.session.user.full_name
                }
            }
        });
    } catch (error) {
        console.error('Admin dashboard error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};