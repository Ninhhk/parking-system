const {pool} = require('../config/db')

exports.getAllNotifications = async () => {
    const query = `SELECT Notifications.*, Users.username
                    FROM Notifications JOIN Users
                        ON Notifications.user_id = Users.user_id`;
    const result = await pool.query(query);
    return result.rows;
}

exports.getNotificationById = async (id) => {
    const query = `SELECT Notifications.*, Users.username
                    FROM Notifications JOIN Users
                        ON Notifications.user_id = Users.user_id
                    WHERE Notifications.noti_id = $1`;
    const result = await pool.query(query, [id]);
    return result.rows[0];
}

exports.createNotification = async (title, message, user_id) => {
    const query = `
        INSERT INTO Notifications (title, message, user_id)
        VALUES ($1, $2, $3)
        RETURNING *
    `;
    const result = await pool.query(query, [title, message, user_id]);
    return result.rows[0];
}

exports.deleteNotification = async (id) => {
    const query = `DELETE FROM Notifications WHERE noti_id = $1 RETURNING *`;
    const result = await pool.query(query, [id]);
    return result.rows[0];
}

exports.updateNotification = async (id, title, message) => {
    const query = `
        UPDATE Notifications
        SET title = $1, message = $2
        WHERE noti_id = $3
        RETURNING *
    `;
    const result = await pool.query(query, [title, message, id]);
    return result.rows[0];
};
