const notiRepo = require('../repositories/admin.noti.repo');

exports.getAllNotifications = async (req, res) => {
    try {
        const notifications = await notiRepo.getAllNotifications();
        res.status(200).json({
            success: true,
            data: notifications
        });
    } catch (error) {
        console.error("Error fetching notifications:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

exports.getNotificationById = async (req, res) => {
    try {
        const { id } = req.params;
        const notification = await notiRepo.getNotificationById(id);
        
        if (!notification) {
            return res.status(404).json({
                success: false,
                message: 'Notification not found'
            });
        }

        res.status(200).json({
            success: true,
            data: notification
        });
    } catch (error) {
        console.error("Error fetching notification:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

exports.createNotification = async (req, res) => {
    try {
        const { title, message, user_id } = req.body;

        // Validate required fields
        if ( !title || !message || !user_id ) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields'
            });
        }

        const newNotification = await notiRepo.createNotification(title, message, user_id);
        res.status(201).json({
            success: true,
            data: newNotification
        });
    } catch (error) {
        console.error("Error creating notification:", error);
        res.status(500).json({ message: "Internal server error" });
    }
}

exports.deleteNotification = async (req, res) => {
    try {
        const { id } = req.params;
        const deletedNotification = await notiRepo.deleteNotification(id);
        
        if (!deletedNotification) {
            return res.status(404).json({
                success: false,
                message: 'Notification not found'
            });
        }

        res.status(200).json({
            success: true,
            data: deletedNotification
        });
    } catch (error) {
        console.error("Error deleting notification:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

exports.updateNotification = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, message } = req.body;

        // Validate required fields
        if ( !title || !message ) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields'
            });
        }

        const updatedNotification = await notiRepo.updateNotification(id, title, message);
        
        if (!updatedNotification) {
            return res.status(404).json({
                success: false,
                message: 'Notification not found'
            });
        }

        res.status(200).json({
            success: true,
            data: updatedNotification
        });
    } catch (error) {
        console.error("Error updating notification:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

