const ApiError = require('../error/ApiError');
const jwt = require('jsonwebtoken');
const pool = require('../db_pg'); // Подключение к базе через pg

class CarController {

    async getProfileCar(req, res, next) {
        try {
            const userId = req.user.id; // Получаем ID пользователя из запроса
            const result = await pool.query(
                'SELECT * FROM public.getProfileCar($1)',
                [userId]
            );
            
            // Если данные найдены
            if (result.rows.length > 0) {
                const carData = result.rows;
            
            
                // Отправляем данные клиенту
                res.json({ success: true, car: carData });
            } else {
                // Если пользователь не найден
                res.status(404).json({ success: false, message: 'Пользователь не найден' });
            }
        } catch (error) {
            console.error('Ошибка при получении данных пользователя:', error);
            next(ApiError.internal('Ошибка при получении данных пользователя'));
        }
    }

    async create(req, res, next) {
        try {
            const userId = req.user.id; // Получаем ID пользователя из токена
            const {
                mark,
                brand,
                color,
                car_number,
                sts_number,
                seats,
            } = req.body;

            // Проверка обязательных полей
            if (!mark || !brand || !color || !car_number || !sts_number || !seats) {
                return next(ApiError.badRequest('Необходимо заполнить все обязательные поля.'));
            }

            // Вызов функции create_car из PostgreSQL
            await pool.query(
                `SELECT * FROM create_car($1, $2, $3, $4, $5, $6, $7)`,
                [userId, brand, color, seats, sts_number, car_number, mark]
            );

            // Возвращаем сообщение об успешном создании
            return res.json({ success: true, message: "Машина успешно создана." });
        } catch (error) {
            // Обработка ошибок уникальности
            if (error.code === '23505') { // Код ошибки уникальности в PostgreSQL
                if (error.constraint === 'unique_car_number') {
                    return next(ApiError.badRequest('Машина с таким номером уже существует.'));
                }
                if (error.constraint === 'unique_sts_number') {
                    return next(ApiError.badRequest('Машина с таким номером СТС уже существует.'));
                }
            }
            // Обработка других ошибок
            return next(ApiError.internal('Ошибка при создании машины: ' + error.message));
        }
    }

    async deleteByNumber(req, res, next) {
        const { carNumber } = req.params; // Получаем госномер из параметров URL
        try {
            await pool.query('SELECT public.deleteByNumber($1)', [carNumber]);
            res.status(200).json({ success: true, message: "Транспортное средство удалено." });
        } catch (error) {
            console.error("Ошибка при удалении транспортного средства:", error);
            res.status(404).json({ success: false, message: error.message });
        }
    }
}

module.exports = new CarController();