const ApiError = require('../error/ApiError');
const pool = require('../db_pg');

class StopController {
    async create(req, res, next) {
        try {
            // Деструктурируем параметры из запроса
            const { arrival_location, trip_id } = req.body;

            // Проверяем, что все обязательные поля переданы
            if (!arrival_location || !trip_id) {
                return next(ApiError.badRequest('Необходимо указать место прибытия и ID поездки.'));
            }

            // Вызов процедуры create_stop
            await pool.query(
                `CALL public.create_stop($1, $2)`,
                [arrival_location, trip_id]
            );

            // Возвращаем успешный ответ
            return res.json({ message: 'Остановка успешно создана.' });
        } catch (error) {
            console.error('Ошибка при создании остановки:', error);

            // Обработка ошибок из PostgreSQL
            if (error.message.includes('Поездка с ID')) {
                return next(ApiError.badRequest(error.message));
            }

            // Возвращаем общую ошибку сервера
            return next(ApiError.internal('Ошибка сервера: ' + error.message));
        }
    }
}

module.exports = new StopController();
