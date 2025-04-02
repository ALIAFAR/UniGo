const ApiError = require('../error/ApiError');
const pool = require('../db_pg');

class TripController {
    async create(req, res, next) {
        console.log("check 0")
        try {
            const userId = req.user.id; // ID пользователя (водителя)
            const {
                route_id,
                departureDate,
                departureTime,
                arrivalDate,
                arrivalTime,
                passengersCount,
                car, // car_number
                price,
                oversizedLuggageComment,
                childSeatComment,
                animalsComment,
                tripComment,
                bookingType,
                canTakeBaggage,
                hasOversizedBaggage,
                needsChildSeat,
                canTakeAnimals
            } = req.body;
    
            console.log("check 1");
    
            // Преобразуем строки в Date-объекты для PostgreSQL
            const departureTimestamp = new Date(`${departureDate}T${departureTime}:00Z`);
            const arrivalTimestamp = new Date(`${arrivalDate}T${arrivalTime}:00Z`);
    
            console.log(departureTimestamp, arrivalTimestamp);
    
            try {
                // Вызов функции create_trip
                const { rows } = await pool.query(
                    `SELECT public.create_trip(
                        $1::VARCHAR,  -- car_number
                        $2::INTEGER,  -- route_id
                        $3::INTEGER,  -- driver_id (userId)
                        $4::NUMERIC,  -- cost (price)
                        $5::SMALLINT, -- trip_number (можно передать 1, если не используется)
                        $6::SMALLINT, -- seats (passengersCount)
                        $7::SMALLINT, -- available_seats (passengersCount)
                        $8::VARCHAR,  -- trip_status (например, 'active')
                        $9::SMALLINT, -- reschedule (например, 0)
                        $10::TIMESTAMP, -- departure_time
                        $11::TIMESTAMP, -- arrival_time
                        NULL::TIMESTAMP, -- travel_time (NULL, так как можно вычислить разницу)
                        $12::TEXT,     -- comment (tripComment)
                        $13::BOOLEAN,  -- instant_booking
                        $14::BOOLEAN,  -- luggage_allowed
                        $15::BOOLEAN,  -- oversized_luggage
                        $16::TEXT,     -- oversized_luggage_comment
                        $17::BOOLEAN,  -- child_seat_available
                        $18::TEXT,     -- child_seat_comment
                        $19::BOOLEAN,  -- pets_allowed
                        $20::TEXT      -- pets_comment
                    ) AS trip_id`,
                    [
                        car, // car_number
                        route_id,
                        userId, // driver_id
                        price,
                        1, // trip_number (заглушка)
                        passengersCount, // seats
                        passengersCount, // available_seats
                        'active', // trip_status
                        0, // reschedule
                        departureTimestamp, // departure_time
                        arrivalTimestamp, // arrival_time
                        tripComment, // comment
                        bookingType === 'instant', // instant_booking (true/false)
                        canTakeBaggage === 'yes', // luggage_allowed (true/false)
                        hasOversizedBaggage === 'yes', // oversized_luggage (true/false)
                        oversizedLuggageComment || null, // oversized_luggage_comment (NULL, если не задан)
                        needsChildSeat === 'yes', // child_seat_available (true/false)
                        childSeatComment || null, // child_seat_comment (NULL, если не задан)
                        canTakeAnimals === 'yes', // pets_allowed (true/false)
                        animalsComment || null // pets_comment (NULL, если не задан)
                    ]
                );
    
                const tripId = rows[0].trip_id; // ID созданной поездки
    
                return res.json({ tripId }); // Успешный ответ с ID поездки
            } catch (dbError) {
                // Обработка ошибок из PostgreSQL
                if (dbError.message.includes('Машина с номером')) {
                    return next(ApiError.badRequest('Машина с указанным номером не найдена.'));
                }
                if (dbError.message.includes('Количество мест в поездке')) {
                    return next(ApiError.badRequest('Количество мест в поездке превышает количество мест в машине.'));
                }
                if (dbError.message.includes('departure_time должно быть больше текущего времени')) {
                    return next(ApiError.badRequest('Время отправления должно быть больше текущего времени.'));
                }
                if (dbError.message.includes('arrival_time должно быть больше departure_time')) {
                    return next(ApiError.badRequest('Время прибытия должно быть позже времени отправления.'));
                }
                // Пробрасываем другие ошибки
                throw dbError;
            }
        } catch (error) {
            return next(ApiError.internal('Ошибка при создании поездки: ' + error.message));
        }
    }
    
    

    async get_driver_trips(req, res, next) {
        try {
            // Получаем ID водителя из авторизованного пользователя
            const driverId = req.user.id;
    
            // Выполняем SQL-запрос к базе данных, используя функцию get_driver_trips
            const query = `
                SELECT * FROM public.get_driver_trips($1);
            `;
    
            // Выполняем запрос с передачей driverId в качестве параметра
            const result = await pool.query(query, [driverId]);
    
            // Отправляем результат клиенту
            res.status(200).json({
                success: true,
                data: result.rows, // Данные о поездках
            });
        } catch (error) {
            // Обработка ошибок
            console.error("Ошибка при получении поездок водителя:", error);
            next(error); // Передаем ошибку в middleware обработки ошибок
        }
    }
    

    async search_result(req, res, next) {
        console.log("заработало")
        try {
            const {
                departure_location,
                arrival_location,
                trip_date,
                seats_needed
            } = req.query; // Изменили с req.body на req.query
            
            console.log("Параметры запроса:", { 
                departure_location, 
                arrival_location, 
                trip_date, 
                seats_needed 
            });
    
            // Проверка обязательных параметров
            if (!departure_location || !arrival_location || !trip_date || !seats_needed) {
                throw new Error('Необходимо указать все параметры поиска');
            }
    
            // Вызов функции search_active_trips_partial
            const { rows } = await pool.query(
                `SELECT * FROM search_active_trips_partial($1::VARCHAR, $2::VARCHAR, $3::DATE, $4::SMALLINT)`,
                [
                    departure_location,
                    arrival_location,
                    trip_date,
                    parseInt(seats_needed) // Преобразуем в число
                ]
            );
    
            console.log("Найдено поездок:", rows.length);
            return res.json(rows);
        } catch (error) {
            console.error('Ошибка:', error);
            next(ApiError.internal('Ошибка при поиске поездок: ' + error.message));
        }
    }   

}

module.exports = new TripController();
