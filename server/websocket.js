const WebSocket = require('ws');
const pool = require('./db_pg');

function setupWebSocket(server) {
    const wss = new WebSocket.Server({ server });
    const activeConnections = new Map();

    wss.on('connection', (ws, req) => {
        console.log('Новое WebSocket подключение');

        ws.on('message', async (message) => {
            try {
                const data = JSON.parse(message);

                if (data.type === 'auth' && data.user_id) {
                    activeConnections.set(data.user_id, ws);
                    console.log(`Пользователь ${data.user_id} авторизован`);
                    
                    // Отправляем количество непрочитанных уведомлений при подключении
                    const unreadRes = await pool.query(
                        `SELECT COUNT(*) FROM notifications 
                         WHERE user_id = $1 AND is_read = FALSE`,
                        [data.user_id]
                    );
                    
                    ws.send(JSON.stringify({
                        type: 'unread_notifications',
                        count: parseInt(unreadRes.rows[0].count)
                    }));
                    
                    return;
                }

                if (data.type === 'message' && data.chat_id && data.sender_id && data.content) {
                    const res = await pool.query(
                        `INSERT INTO messages (chat_id, sender_id, content) 
                         VALUES ($1, $2, $3) RETURNING *`,
                        [data.chat_id, data.sender_id, data.content]
                    );

                    const chatRes = await pool.query(
                        `SELECT 
                            c.passenger_id, 
                            t.driver_id 
                        FROM chats c
                        JOIN trips t ON c.trip_id = t.id
                        WHERE c.id = $1`,
                        [data.chat_id]
                    );

                    if (chatRes.rows.length === 0) {
                        throw new Error('Чат не найден');
                    }

                    const chat = chatRes.rows[0];
                    const recipientId = chat.passenger_id === data.sender_id 
                        ? chat.driver_id 
                        : chat.passenger_id;

                    if (activeConnections.has(recipientId)) {
                        activeConnections.get(recipientId).send(JSON.stringify({
                            type: 'message',
                            chat_id: data.chat_id,
                            sender_id: data.sender_id,
                            content: data.content,
                            sent_at: res.rows[0].sent_at
                        }));
                    }

                    ws.send(JSON.stringify({
                        type: 'message_sent',
                        message_id: res.rows[0].id,
                        sent_at: res.rows[0].sent_at
                    }));
                }

                if (data.type === 'mark_notification_read' && data.notification_id) {
                    await pool.query(
                        `UPDATE notifications SET is_read = TRUE 
                         WHERE id = $1 AND user_id = $2`,
                        [data.notification_id, data.user_id]
                    );
                    
                    // Отправляем обновленное количество непрочитанных
                    const unreadRes = await pool.query(
                        `SELECT COUNT(*) FROM notifications 
                         WHERE user_id = $1 AND is_read = FALSE`,
                        [data.user_id]
                    );
                    
                    if (activeConnections.has(data.user_id)) {
                        activeConnections.get(data.user_id).send(JSON.stringify({
                            type: 'unread_notifications',
                            count: parseInt(unreadRes.rows[0].count)
                        }));
                    }
                }

            } catch (err) {
                console.error('WebSocket ошибка:', err);
                ws.send(JSON.stringify({
                    type: 'error',
                    error: err.message
                }));
            }
        });

        ws.on('close', () => {
            for (const [userId, connection] of activeConnections.entries()) {
                if (connection === ws) {
                    activeConnections.delete(userId);
                    console.log(`Пользователь ${userId} отключился`);
                    break;
                }
            }
        });
    });

    // Функция для отправки уведомлений
    wss.sendNotification = async (userId, notificationData) => {
        try {
            // Сохраняем уведомление в БД
            const res = await pool.query(
                `INSERT INTO notifications (user_id, type, message, trip_id, booking_id)
                 VALUES ($1, $2, $3, $4, $5) RETURNING *`,
                [
                    userId,
                    notificationData.type,
                    notificationData.message,
                    notificationData.trip_id || null,
                    notificationData.booking_id || null
                ]
            );

            // Отправляем уведомление через WebSocket, если пользователь онлайн
            if (activeConnections.has(userId)) {
                const notification = res.rows[0];
                activeConnections.get(userId).send(JSON.stringify({
                    type: 'new_notification',
                    notification: {
                        id: notification.id,
                        type: notification.type,
                        message: notification.message,
                        created_at: notification.created_at,
                        is_read: notification.is_read,
                        trip_id: notification.trip_id,
                        booking_id: notification.booking_id
                    }
                }));

                // Обновляем счетчик непрочитанных
                const unreadRes = await pool.query(
                    `SELECT COUNT(*) FROM notifications 
                     WHERE user_id = $1 AND is_read = FALSE`,
                    [userId]
                );
                
                activeConnections.get(userId).send(JSON.stringify({
                    type: 'unread_notifications',
                    count: parseInt(unreadRes.rows[0].count)
                }));
            }
            
            return res.rows[0];
        } catch (err) {
            console.error('Ошибка при отправке уведомления:', err);
            throw err;
        }
    };

    return wss;
}

module.exports = setupWebSocket;