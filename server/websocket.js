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

    return wss;
}

module.exports = setupWebSocket;