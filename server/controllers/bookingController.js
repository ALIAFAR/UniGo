const ApiError = require('../error/ApiError');
const pool = require('../db_pg'); // Подключение к базе через pg
const { wss } = require('../websocket');
const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');

const crypto = require('crypto');

const sendResetEmail = async (email, token) => {
    console.log("reset1")
    const transporter = nodemailer.createTransport({
        service: process.env.EMAIL_SERVICE,
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });

    const resetUrl = `${process.env.FRONTEND_URL}my-trips`;

    await transporter.sendMail({
        from: process.env.EMAIL_FROM,
        to: email,
        subject: 'УРА! ВАС НАШЕЛ ВАШ ПОПУТЧИК!',
        html: `
            <p>Ваша поездка забронирована!</p>
            <a href="${resetUrl}">${resetUrl}</a>
            <p>Ссылка действительна в течение 1 часа.</p>
        `
    });
};

class BookingController{
    async create(req, res, next) {
        try {
            const userId = req.user.id;
            let {
                trip_id,
                chat_id,
                booking_status = 'unpaid', // значение по умолчанию
                booking_date = new Date().toISOString(), // текущая дата, если не передана
                seats_booked,
                reservation_status = 'active' // значение по умолчанию
            } = req.body;

            // 1. Получаем instant_booking из trips
            const tripCheck = await pool.query(
                `SELECT instant_booking, available_seats FROM trips WHERE id = $1`,
                [trip_id]
            );

            if (tripCheck.rows.length === 0) {
                return next(ApiError.notFound('Поездка не найдена'));
            }

            // 2. Определяем статус бронирования
            const instant_booking = tripCheck.rows[0].instant_booking;
            booking_status = instant_booking ? 'paid' : 'unpaid';
    
            // Вставляем бронирование и возвращаем созданную запись
            const { rows } = await pool.query(
                `INSERT INTO bookings (
                    passenger_id, 
                    trip_id,
                    chat_id,
                    booking_status,
                    booking_date,
                    seats_booked,
                    reservation_status
                ) VALUES ($1, $2, $3, $4, $5, $6, $7) 
                 RETURNING *`, 
                [
                    userId,
                    trip_id,
                    chat_id,
                    booking_status,
                    booking_date,
                    seats_booked,
                    reservation_status
                ]
            );

            // Обновляем в БД через вызов функции update_user_img
            await pool.query(`UPDATE trips 
                SET available_seats = available_seats - $2,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $1`, [trip_id, seats_booked]);
    
            // Получаем обновлённые данные поездки
            const tripResult = await pool.query(
                'SELECT * FROM trips WHERE id = $1',
                [trip_id]
            );

             // Получаем экземпляр WebSocket сервера из app
            const webSocketServer = req.app.get('websocket');
            
            // Отправляем уведомление
            const notification = await webSocketServer.sendNotification(tripResult.rows[0].driver_id, {
                type: 'booking',
                message: 'Ваша поездка была забронирована',
                trip_id: trip_id,
                booking_id: rows[0].id
            });

            await sendResetEmail("alifarvazova@gmail.com");

            return res.json({
                success: true,
                booking: rows[0], // возвращаем созданное бронирование
                trip: tripResult.rows[0] // возвращаем обновлённые данные поездки
            });
    
        } catch (error) {
            console.error(error);
            
            // Обработка ошибки дублирования
            if (error.code === '23505') {
                return next(ApiError.badRequest('Бронирование уже существует'));
            }
            
            return next(ApiError.internal('Ошибка при создании брони'));
        }
    }

    async get_booked_trips(req, res, next) {
        console.log("пиздец с бронью")
        try {
            const userId = req.user.id; // получаем ID пользователя из авторизации
            console.log("userId: ",userId)
        
            // Выполняем запрос к функции в PostgreSQL
            const { rows } = await pool.query(
                'SELECT * FROM get_booked_trips($1)',
                [userId]
            );
            console.log("БРОООНЬ ")
            console.log(rows)
            // Возвращаем данные в нужном формате
            return res.json({
                success: true,
                bookedTrips: rows // данные должны быть в поле bookedTrips
            });
        } catch (error) {
            console.error(error);
            return next(ApiError.internal('Ошибка при получении забронированных поездок'));
        }
    }
    
    async cancell_book(req, res, next) {
        try {
            const userId = req.user.id;
            const bookingId = req.params.id;
            const { seats_booked } = req.body;

            console.log(`Отмена бронирования ${bookingId}, мест: ${seats_booked}`);

            // 1. Сначала получаем данные бронирования
            const bookingResult = await pool.query(
                `SELECT trip_id FROM bookings WHERE id = $1`,
                [bookingId]
            );

            if (bookingResult.rows.length === 0) {
                return next(ApiError.notFound('Бронирование не найдено'));
            }

            const tripId = bookingResult.rows[0].trip_id;

            // 2. Удаляем связанный чат
            await pool.query(
                `DELETE FROM chats 
                WHERE passenger_id = $1 AND trip_id = $2`,
                [userId, tripId]
            );

            // 3. Обновляем статус бронирования
            const { rowCount } = await pool.query(
                `UPDATE bookings
                SET reservation_status = 'cancel'
                WHERE id = $1`,
                [bookingId]
            );

            // 4. Возвращаем места в поездку (если указано seats_booked)
            if (seats_booked) {
                await pool.query(
                    `UPDATE trips 
                    SET available_seats = available_seats + $1
                    WHERE id = $2`,
                    [seats_booked, tripId]
                );
            }

            return res.json({
                success: true,
                message: 'Бронирование успешно отменено',
                seats_returned: seats_booked || 0
            });

        } catch (error) {
            console.error(error);
            return next(ApiError.internal('Ошибка при отмене бронирования'));
        }
    }
}

module.exports=new BookingController()