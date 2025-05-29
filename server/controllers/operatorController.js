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

    // Получение списка пользователей для проверки (driver_status = 1)
    async getUsersForVerification(req, res, next) {
        try {
            const { rows } = await pool.query(`
                SELECT u.*, f.surname, f.name, f.middlename, f.department, f.position
                FROM users u
                JOIN forms f ON u.form_id = f.id
                WHERE u.driver_status = 1
                ORDER BY u.registration_date DESC
            `);

            return res.json({
                success: true,
                users: rows.map(user => ({
                    ...user,
                    fullName: `${user.surname} ${user.name} ${user.middlename || ''}`.trim()
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
                WHERE id = $1 AND driver_status = 1 RETURNING id`,
                [userId]
            );

            if (rowCount === 0) {
                return next(ApiError.badRequest('Пользователь не найден или уже подтвержден'));
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
                WHERE id = $1 AND driver_status = 1 RETURNING id`,
                [userId]
            );

            if (rowCount === 0) {
                return next(ApiError.badRequest('Пользователь не найден или уже отклонен'));
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

    // Получение списка автомобилей для проверки (car_status = false)
    async getCarsForVerification(req, res, next) {
        try {
            const { rows } = await pool.query(`
                SELECT c.*, u.login, f.surname, f.name, f.middlename
                FROM cars c
                JOIN users u ON c.user_id = u.id
                JOIN forms f ON u.form_id = f.id
                WHERE c.car_status = false
                ORDER BY c.created_at DESC
            `);

            return res.json({
                success: true,
                cars: rows
            });

        } catch (error) {
            console.error('Ошибка при получении автомобилей:', error);
            return next(ApiError.internal('Ошибка при получении списка автомобилей'));
        }
    }

    // Подтверждение автомобиля (car_status = true)
    async approveCar(req, res, next) {
        try {
            const { carId } = req.params;
            
            const { rowCount } = await pool.query(
                `UPDATE cars SET car_status = true 
                WHERE id = $1 AND car_status = false RETURNING id`,
                [carId]
            );

            if (rowCount === 0) {
                return next(ApiError.badRequest('Автомобиль не найден или уже подтвержден'));
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

    // Получение поездок пользователя
    async getUserTrips(req, res, next) {
        try {
            const { userId } = req.params;
            
            // Запрос для созданных поездок (как водитель)
            const createdTrips = await pool.query(`
                SELECT * FROM trips 
                WHERE driver_id = $1
                ORDER BY departure_time DESC
                LIMIT 10
            `, [userId]);

            // Запрос для поездок пассажиром
            const passengerTrips = await pool.query(`
                SELECT t.* FROM trips t
                JOIN trip_passengers tp ON t.id = tp.trip_id
                WHERE tp.user_id = $1
                ORDER BY t.departure_time DESC
                LIMIT 10
            `, [userId]);

            return res.json({
                success: true,
                createdTrips: createdTrips.rows,
                passengerTrips: passengerTrips.rows
            });

        } catch (error) {
            console.error('Ошибка при получении поездок пользователя:', error);
            return next(ApiError.internal('Ошибка при получении поездок пользователя'));
        }
    }

    // Блокировка пользователя
    async blockUser(req, res, next) {
        try {
            const { userId } = req.params;
            
            const { rowCount } = await pool.query(
                `UPDATE users SET profile_status = false 
                WHERE id = $1 AND profile_status = true RETURNING id`,
                [userId]
            );

            if (rowCount === 0) {
                return next(ApiError.badRequest('Пользователь не найден или уже заблокирован'));
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

    // Разблокировка пользователя
    async unblockUser(req, res, next) {
        try {
            const { userId } = req.params;
            
            const { rowCount } = await pool.query(
                `UPDATE users SET profile_status = true 
                WHERE id = $1 AND profile_status = false RETURNING id`,
                [userId]
            );

            if (rowCount === 0) {
                return next(ApiError.badRequest('Пользователь не найден или уже разблокирован'));
            }

            return res.json({
                success: true,
                message: 'Пользователь разблокирован'
            });

        } catch (error) {
            console.error('Ошибка при разблокировке пользователя:', error);
            return next(ApiError.internal('Ошибка при разблокировке пользователя'));
        }
    }
}

module.exports = new OperatorController();