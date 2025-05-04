const ApiError = require('../error/ApiError');
const jwt = require('jsonwebtoken');
const pool = require('../db_pg'); // Подключение к базе через pg

class ChatController{
    async create(req, res, next) {
        try {
            const userId = req.user.id;
            const { trip_id } = req.body;
            // Вставляем новую запись чата и возвращаем ID
            const { rows } = await pool.query(
                `INSERT INTO chats (passenger_id, trip_id) 
                 VALUES ($1, $2) 
                 RETURNING id`,
                [userId, trip_id]
            );

            // Возвращаем success и ID созданного чата
            return res.json({
                success: true,
                chatId: rows[0].id
            });
            
        } catch (error) {
            console.error(error);
            
            // Проверяем, является ли ошибка нарушением уникальности
            if (error.code === '23505') { // Код ошибки нарушения уникального ограничения
                return next(ApiError.badRequest('Чат для этой поездки уже существует'));
            }
            
            return next(ApiError.internal('Ошибка при создании чата'));
        }
    }

    async getAll(req, res, next) {
        try {
            const userId = req.user.id;
            // Простой запрос только для чатов
            const { rows } = await pool.query(
                `SELECT 
                    c.id,
                    c.trip_id,
                    t.departure_time,
                    r.departure_location,
                    r.arrival_location,
                    c.passenger_id,
                    CASE WHEN c.passenger_id = $1 THEN 'passenger' ELSE 'driver' END as chat_type
                FROM chats c
                JOIN trips t ON c.trip_id = t.id
                JOIN routes r ON t.route_id = r.id
                WHERE c.passenger_id = $1 OR t.driver_id = $1
                ORDER BY t.departure_time DESC`,
                [userId]
            );
    
            return res.json(rows);
            
        } catch (error) {
            console.error('Ошибка при получении чатов:', error);
            return next(ApiError.internal('Ошибка при получении списка чатов'));
        }
    }

    async getOne(req, res, next) {
        try {
            const chatId = req.params.id;
            // Получаем информацию о чате и связанной поездке
            const { rows } = await pool.query(
                `SELECT 
                    c.id,
                    c.passenger_id,
                    c.trip_id,
                    t.driver_id,
                    t.departure_time,
                    t.arrival_time,
                    r.departure_location,
                    r.arrival_location,
                    t.trip_status,
                    t.car_id
                 FROM chats c
                 JOIN trips t ON c.trip_id = t.id
                 JOIN routes r ON t.route_id = r.id
                 WHERE c.id = $1`,
                [chatId]
            );
    
            if (rows.length === 0) {
                return next(ApiError.notFound('Чат не найден'));
            }
            const chatData = rows[0];
            
            // Формируем минимальный ответ
            return res.json({
                id: chatData.id,
                trip_id: chatData.trip_id,
                passenger_id: chatData.passenger_id,
                driver_id: chatData.driver_id,
                departure_location: chatData.departure_location,
                arrival_location: chatData.arrival_location,
                departure_time: chatData.departure_time,
                arrival_time: chatData.arrival_time,
                trip_status: chatData.trip_status,
                car_id: chatData.car_id
            });
    
        } catch (error) {
            console.error('Ошибка при получении чата:', error);
            return next(ApiError.internal('Ошибка при получении данных чата'));
        }
    }


    async getMessages(req, res, next) {
        console.log("chat1")
        try {
            const chatId = req.params.id;
            //const userId = req.user.id; // ID текущего пользователя
            console.log("chat2")
            // Получаем сообщения для указанного чата
            const { rows } = await pool.query(
                `SELECT 
                    m.id,
                    m.chat_id,
                    m.sender_id,
                    m.content,
                    m.sent_at,
                    u.img as sender_avatar,
                    f.name as sender_name,
                    f.surname as sender_surname
                 FROM messages m
                 JOIN users u ON m.sender_id = u.id
                 JOIN forms f ON u.form_id = f.id
                 WHERE m.chat_id = $1
                 ORDER BY m.sent_at ASC`,
                [chatId]
            );
            console.log("chat1")
            // Форматируем данные для ответа
            const messages = rows.map(msg => ({
                id: msg.id,
                chat_id: msg.chat_id,
                sender_id: msg.sender_id,
                content: msg.content,
                sent_at: msg.sent_at,
                sender_avatar: msg.sender_avatar || '/default-avatar.jpg',
                sender_name: msg.sender_name,
                sender_surname: msg.sender_surname
            }));
    
            return res.json(messages);
    
        } catch (error) {
            console.error('Ошибка при получении сообщений:', error);
            return next(ApiError.internal('Ошибка при загрузке сообщений чата'));
        }
    }

}

module.exports=new ChatController()