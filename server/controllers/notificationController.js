const pool = require('./db_pg');

const notificationController = {
    // Получить все уведомления пользователя
    getUserNotifications: async (req, res) => {
        try {
            const { userId } = req.params;
            const { limit = 20, offset = 0 } = req.query;

            const notifications = await pool.query(
                `SELECT * FROM notifications 
                 WHERE user_id = $1 
                 ORDER BY created_at DESC
                 LIMIT $2 OFFSET $3`,
                [userId, limit, offset]
            );

            res.json(notifications.rows);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    // Пометить уведомление как прочитанное
    markAsRead: async (req, res) => {
        try {
            const { notificationId } = req.params;
            const userId = req.user.id; // Предполагается, что есть middleware аутентификации

            await pool.query(
                `UPDATE notifications SET is_read = TRUE 
                 WHERE id = $1 AND user_id = $2`,
                [notificationId, userId]
            );

            res.json({ success: true });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    // Пометить все уведомления как прочитанные
    markAllAsRead: async (req, res) => {
        try {
            const userId = req.user.id;

            await pool.query(
                `UPDATE notifications SET is_read = TRUE 
                 WHERE user_id = $1 AND is_read = FALSE`,
                [userId]
            );

            res.json({ success: true });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    // Получить количество непрочитанных уведомлений
    getUnreadCount: async (req, res) => {
        try {
            const userId = req.user.id;

            const result = await pool.query(
                `SELECT COUNT(*) FROM notifications 
                 WHERE user_id = $1 AND is_read = FALSE`,
                [userId]
            );

            res.json({ count: parseInt(result.rows[0].count) });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
};

module.exports = notificationController;