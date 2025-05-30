const ApiError = require('../error/ApiError');
const pool = require('../db_pg');

class OperatorController {
    // Создание пользователей (из формы)
    async create_users(req, res, next) {
        try {
            const usersData = req.body.data;
            
            if (!usersData || !Array.isArray(usersData)) {
                return next(ApiError.badRequest('Неверный формат данных. Ожидается массив пользователей.'));
            }

            const client = await pool.connect();
            
            try {
                await client.query('BEGIN');
                
                for (const user of usersData) {
                    const { surname, name, middlename, password, department, position } = user;
                    
                    await client.query(
                        `INSERT INTO forms (surname, name, middlename, password, department, position) 
                        VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
                        [surname, name, middlename, password, department, position]
                    );
                }
                
                await client.query('COMMIT');
                
                return res.json({ 
                    success: true,
                    message: `Успешно добавлено ${usersData.length} пользователей`
                });
                
            } catch (err) {
                await client.query('ROLLBACK');
                throw err;
            } finally {
                client.release();
            }
            
        } catch (error) {
            console.error('Ошибка при создании пользователей:', error);
            return next(ApiError.internal('Ошибка при сохранении пользователей в базу данных'));
        }
    }

    async getUsers(req, res, next) {
        try {
            const { status } = req.query;
            
            let query = `
                SELECT 
                    u.id, u.login, u.email, u.phone_number, u.driver_rating as rating, u.driver_status as status, u.birthday as birth_date,
                    u.profile_status as is_blocked, u.registration_date,
                    f.surname, f.name, f.middlename, u.license_number, u.license_issue_date,
                    (
                        SELECT json_agg(json_build_object(
                            'id', c.id,
                            'brand', c.brand,
                            'model', c.mark
                        ))
                        FROM cars c WHERE c.user_id = u.id
                    ) as cars
                FROM users u
                JOIN forms f ON u.form_id = f.id
            `;
            
            const params = [];
            
            if (status) {
                query += ` WHERE u.driver_status = $1`;
                params.push(status);
            }
            
            query += ` ORDER BY u.registration_date DESC`;
            
            const { rows } = await pool.query(query, params);
            
            return res.json({
                success: true,
                users: rows.map(user => ({
                    ...user,
                    fullName: `${user.surname} ${user.name} ${user.middlename || ''}`.trim(),
                    isConfirmed: user.status === 2,
                    birthDate: user.birth_date,
                    licenseIssueDate: user.license_issue_date,
                    licenseNumber: user.license_number,
                    cars: user.cars || []
                }))
            });

        } catch (error) {
            console.error('Ошибка при получении пользователей:', error);
            return next(ApiError.internal('Ошибка при получении списка пользователей'));
        }
    }

    // Подтверждение пользователя (driver_status = 2)
    async approveUser(req, res, next) {
        try {
            const { userId } = req.params;
            
            const { rowCount } = await pool.query(
                `UPDATE users SET driver_status = 2 
                WHERE id = $1 RETURNING id`,
                [userId]
            );

            if (rowCount === 0) {
                return next(ApiError.badRequest('Пользователь не найден'));
            }

            return res.json({
                success: true,
                message: 'Пользователь успешно подтвержден'
            });

        } catch (error) {
            console.error('Ошибка при подтверждении пользователя:', error);
            return next(ApiError.internal('Ошибка при подтверждении пользователя'));
        }
    }

    // Отклонение пользователя (driver_status = -1)
    async rejectUser(req, res, next) {
        try {
            const { userId } = req.params;
            
            const { rowCount } = await pool.query(
                `UPDATE users SET driver_status = -1 
                WHERE id = $1 RETURNING id`,
                [userId]
            );

            if (rowCount === 0) {
                return next(ApiError.badRequest('Пользователь не найден'));
            }

            return res.json({
                success: true,
                message: 'Пользователь отклонен'
            });

        } catch (error) {
            console.error('Ошибка при отклонении пользователя:', error);
            return next(ApiError.internal('Ошибка при отклонении пользователя'));
        }
    }

    // Удаление пользователя
    async deleteUser(req, res, next) {
        try {
            const { userId } = req.params;
            
            const { rowCount } = await pool.query(
                `DELETE FROM users WHERE id = $1 RETURNING id`,
                [userId]
            );

            if (rowCount === 0) {
                return next(ApiError.badRequest('Пользователь не найден'));
            }

            return res.json({
                success: true,
                message: 'Пользователь удален'
            });

        } catch (error) {
            console.error('Ошибка при удалении пользователя:', error);
            return next(ApiError.internal('Ошибка при удалении пользователя'));
        }
    }

    // Блокировка пользователя
    async blockUser(req, res, next) {
        try {
            const { userId } = req.params;
            
            const { rowCount } = await pool.query(
                `UPDATE users SET profile_status = false 
                WHERE id = $1 RETURNING id`,
                [userId]
            );

            if (rowCount === 0) {
                return next(ApiError.badRequest('Пользователь не найден'));
            }

            return res.json({
                success: true,
                message: 'Пользователь заблокирован'
            });

        } catch (error) {
            console.error('Ошибка при блокировке пользователя:', error);
            return next(ApiError.internal('Ошибка при блокировке пользователя'));
        }
    }

    // Получение поездок пользователя
    async getUserTrips(req, res, next) {
        try {
            const { userId } = req.params;
            
            // Запрос для созданных поездок (как водитель)
            const createdTripsQuery = `
                SELECT 
                    t.id, t.cost, t.seats, t.available_seats, 
                    t.trip_status as status, t.departure_time, t.arrival_time,
                    t.comment, t.instant_booking, t.luggage_allowed,
                    r.departure_location, r.arrival_location,
                    json_agg(json_build_object(
                        'id', s.id,
                        'location', s.arrival_location
                    )) as stops,
                    json_build_object(
                        'id', c.id,
                        'brand', c.brand,
                        'model', c.mark
                    ) as car
                FROM trips t
                JOIN routes r ON t.route_id = r.id
                LEFT JOIN stops s ON s.trip_id = t.id
                JOIN cars c ON t.car_id = c.id
                WHERE t.driver_id = $1
                GROUP BY t.id, r.id, c.id
                ORDER BY t.departure_time DESC
                LIMIT 10
            `;

            // Запрос для поездок пассажиром
            const passengerTripsQuery = `
                SELECT 
                    t.id, t.cost, t.seats, t.available_seats, 
                    t.trip_status as status, t.departure_time, t.arrival_time,
                    t.comment, t.instant_booking, t.luggage_allowed,
                    r.departure_location, r.arrival_location,
                    json_agg(json_build_object(
                        'id', s.id,
                        'location', s.arrival_location
                    )) as stops,
                    json_build_object(
                        'id', c.id,
                        'brand', c.brand,
                        'model', c.mark
                    ) as car,
                    json_build_object(
                        'id', u.id,
                        'name', f.name,
                        'surname', f.surname
                    ) as driver
                FROM trips t
                JOIN routes r ON t.route_id = r.id
                LEFT JOIN stops s ON s.trip_id = t.id
                JOIN cars c ON t.car_id = c.id
                JOIN users u ON t.driver_id = u.id
                JOIN forms f ON u.form_id = f.id
                JOIN trip_passengers tp ON t.id = tp.trip_id
                WHERE tp.user_id = $1
                GROUP BY t.id, r.id, c.id, u.id, f.id
                ORDER BY t.departure_time DESC
                LIMIT 10
            `;

            const [createdTripsResult, passengerTripsResult] = await Promise.all([
                pool.query(createdTripsQuery, [userId]),
                pool.query(passengerTripsQuery, [userId])
            ]);

            return res.json({
                success: true,
                createdTrips: createdTripsResult.rows.map(trip => ({
                    route: `${trip.departure_location} - ${trip.arrival_location}`,
                    date: trip.departure_time,
                    status: trip.status,
                    car: `${trip.car.brand} ${trip.car.model} (${trip.car.license_plate})`,
                    stops: trip.stops,
                    seats: trip.seats,
                    cost: trip.cost
                })),
                passengerTrips: passengerTripsResult.rows.map(trip => ({
                    route: `${trip.departure_location} - ${trip.arrival_location}`,
                    date: trip.departure_time,
                    status: trip.status,
                    car: `${trip.car.brand} ${trip.car.model} (${trip.car.license_plate})`,
                    driver: `${trip.driver.surname} ${trip.driver.name}`,
                    stops: trip.stops,
                    seats: trip.seats,
                    cost: trip.cost
                }))
            });

        } catch (error) {
            console.error('Ошибка при получении поездок пользователя:', error);
            return next(ApiError.internal('Ошибка при получении поездок пользователя'));
        }
    }

    // Получение списка автомобилей
    async getCars(req, res, next) {
        try {
            const { status } = req.query;
            
            let query = `
                SELECT 
                    c.id, c.brand, c.mark as model, c.color, 
                    c.year, c.car_status as is_confirmed, c.created_at,
                    u.id as user_id, u.login, u.rating,
                    f.surname, f.name, f.middlename
                FROM cars c
                JOIN users u ON c.user_id = u.id
                JOIN forms f ON u.form_id = f.id
            `;
            
            const params = [];
            
            if (status !== undefined) {
                query += ` WHERE c.car_status = $1`;
                params.push(status === 'true');
            }
            
            query += ` ORDER BY c.created_at DESC`;
            
            const { rows } = await pool.query(query, params);
            
            return res.json({
                success: true,
                cars: rows.map(car => ({
                    ...car,
                    ownerName: `${car.surname} ${car.name} ${car.middlename || ''}`.trim()
                }))
            });

        } catch (error) {
            console.error('Ошибка при получении автомобилей:', error);
            return next(ApiError.internal('Ошибка при получении списка автомобилей'));
        }
    }

    // Подтверждение автомобиля
    async approveCar(req, res, next) {
        try {
            const { carId } = req.params;
            
            const { rowCount } = await pool.query(
                `UPDATE cars SET car_status = true 
                WHERE id = $1 RETURNING id`,
                [carId]
            );

            if (rowCount === 0) {
                return next(ApiError.badRequest('Автомобиль не найден'));
            }

            return res.json({
                success: true,
                message: 'Автомобиль успешно подтвержден'
            });

        } catch (error) {
            console.error('Ошибка при подтверждении автомобиля:', error);
            return next(ApiError.internal('Ошибка при подтверждении автомобиля'));
        }
    }

    // Отклонение автомобиля
    async rejectCar(req, res, next) {
        try {
            const { carId } = req.params;
            
            const { rowCount } = await pool.query(
                `DELETE FROM cars WHERE id = $1 RETURNING id`,
                [carId]
            );

            if (rowCount === 0) {
                return next(ApiError.badRequest('Автомобиль не найден'));
            }

            return res.json({
                success: true,
                message: 'Автомобиль отклонен'
            });

        } catch (error) {
            console.error('Ошибка при отклонении автомобиля:', error);
            return next(ApiError.internal('Ошибка при отклонении автомобиля'));
        }
    }
}

module.exports = new OperatorController();