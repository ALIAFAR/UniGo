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
                //arrivalDate,
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
            //const arrivalTimestamp = new Date(`${arrivalDate}T${arrivalTime}:00Z`);

            // Разбиваем время в пути на часы, минуты и секунды
            const [hours, minutes, seconds] = arrivalTime.split(':').map(Number);

            // Создаем копию departureTimestamp, чтобы не изменять оригинал
            const arrivalTimestamp = new Date(departureTimestamp);

            // Добавляем время в пути
            arrivalTimestamp.setHours(arrivalTimestamp.getHours() + hours);
            arrivalTimestamp.setMinutes(arrivalTimestamp.getMinutes() + minutes);
            arrivalTimestamp.setSeconds(arrivalTimestamp.getSeconds() + seconds);

            console.log(arrivalTimestamp); // Результирующая дата и время прибытия

            // Форматируем arrivalTimestamp в строку, аналогичную формату departureTimestamp
            const arrivalDateString = arrivalTimestamp.toISOString().replace(/\.\d+Z$/, 'Z');
            console.log(arrivalDateString); // Например: "2023-12-31T15:19:40Z"
    
            console.log(departureTimestamp, arrivalTimestamp);

            try {
                const statusCheck = await pool.query(
                    'SELECT driver_status FROM users WHERE id = $1',
                    [userId]
                );
                
                if (statusCheck.rows.length === 0 || statusCheck.rows[0].driver_status !== 2) {
                    return next(ApiError.forbidden('Только подтвержденные водители могут создавать поездки'));
                }
            } catch (error) {
                console.error('Ошибка при проверке статуса водителя:', error);
                return next(ApiError.internal('Ошибка при проверке прав доступа'));
            }
    
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
        console.log("Поиск поездок...");
        try {
            

            const {
                departure_location,
                arrival_location,
                date,
                seats
            } = req.query;
    
            console.log("Параметры запроса:", { 
                departure_location, 
                arrival_location, 
                date, 
                seats 
            });
    
            // Проверка обязательных параметров
            if (!departure_location || !arrival_location || !date || !seats) {
                throw new Error('Необходимо указать все параметры поиска');
            }
    
            const seatsNumber = parseInt(seats);
            if (isNaN(seatsNumber)) {
                throw new Error('Количество мест должно быть числом');
            }




    
            // Вызов функции search_active_trips_partial
            const { rows } = await pool.query(
                `SELECT * FROM search_active_trips_partial($1::VARCHAR, $2::VARCHAR, $3::DATE, $4::SMALLINT)`,
                [
                    departure_location,
                    arrival_location,
                    date,
                    seatsNumber
                ]
            );
    
            // Форматируем данные для ответа аналогично get_all
            const result = rows.map(trip => ({
                name: trip.driver_name,
                surname: trip.driver_surname,
                rating: trip.driver_rating,
                license_issue_date: trip.license_issue_date,
                avatarUrl: trip.avatarurl
                    ? `http://localhost:5000/static/${trip.avatarurl}`
                    : '/default-avatar.jpg',
                brand: trip.car_brand,
                mark: trip.car_mark,
                departure_location: trip.departure_location,
                arrival_location: trip.arrival_location,
                stops: trip.stops ? trip.stops.split(', ') : [],
                departure_time: trip.departure_time,
                arrival_time: trip.arrival_time,
                id: trip.trip_id,
                available_seats: trip.available_seats,
                total_seats: trip.total_seats,
                cost: trip.cost,
                instant_booking: trip.instant_booking,
                driver_id:trip.driver_id,
                pets:trip.pets,
                luggage:trip.luggage,
                child_seat:trip.child_seat,
                big_size_luggage:trip.big_size_luggage,
                comment:trip.comment,
                oversized_luggage_comment:trip.oversized_luggage_comment,
                child_seat_comment:trip.child_seat_comment,
                pets_comment:trip.pets_comment
            }));
    
            console.log("Найдено поездок:", result.length);
            return res.json({
                success: true,
                trips: result
            });
    
        } catch (error) {
            console.error('Ошибка:', error);
            next(ApiError.internal('Ошибка при поиске поездок: ' + error.message));
        }
    }  

    async checkDriverStatus(req, res, next) {
    try {
        const userId = req.user.id;
        
        // Проверяем статус водителя
        const { rows } = await pool.query(
            'SELECT driver_status FROM users WHERE id = $1',
            [userId]
        );

        if (rows.length === 0) {
            return res.json({ isDriver: false, message: 'Пользователь не найден' });
        }

        const isDriver = rows[0].driver_status === 2;
        
        return res.json({ 
            success: true,
            isDriver,
            message: isDriver 
                ? 'Пользователь является подтвержденным водителем' 
                : 'Пользователь не является подтвержденным водителем'
        });

    } catch (error) {
        console.error('Ошибка при проверке статуса водителя:', error);
        return next(ApiError.internal('Ошибка при проверке статуса водителя'));
    }
}

}

module.exports = new TripController();
