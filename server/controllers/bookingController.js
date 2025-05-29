const ApiError = require('../error/ApiError');
const pool = require('../db_pg'); // Подключение к базе через pg

class BookingController{
    async create(req, res, next) {
        try {
            const userId = req.user.id;
            const {
                trip_id,
                chat_id,
                booking_status = 'неоплачен', // значение по умолчанию
                booking_date = new Date().toISOString(), // текущая дата, если не передана
                seats_booked,
                reservation_status = 'активен' // значение по умолчанию
            } = req.body;
    
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
        
            // Выполняем запрос к функции в PostgreSQL
            const { rows } = await pool.query(
                'SELECT * FROM get_booked_trips($1)',
                [userId]
            );
        
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
            const bookingId = req.params.id;
            console.log("cancell_book1")
            const { rowCount } = await pool.query(
                `UPDATE bookings
                 SET reservation_status = 'отменен'
                 WHERE id = $1`,
                [bookingId]
            );
            console.log("cancell_book1")
            
            if (rowCount === 0) {
                return next(ApiError.notFound('Бронирование не найдено'));
            }
    
            return res.json({
                success: true,
                message: 'Бронирование успешно отменено'
            });
        } catch (error) {
            console.error(error);
            return next(ApiError.internal('Ошибка при отмене бронирования'));
        }
    }
}

module.exports=new BookingController()