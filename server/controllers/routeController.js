const ApiError = require('../error/ApiError');
const pool = require('../db_pg');

class RouteController {
    async create(req, res, next) {
        try {
            // Деструктурируем параметры из запроса
            const { from, to } = req.body;

            // Проверяем, что все обязательные поля переданы
            if (!from || !to) {
                return next(ApiError.badRequest('Необходимо заполнить все обязательные поля.'));
            }

            // Вызов функции create_route для создания или получения маршрута
            const { rows } = await pool.query(
                `SELECT public.create_route($1, $2) AS route_id`,
                [from, to]
            );

            // Извлекаем ID маршрута
            const routeId = rows[0].route_id;

            // Возвращаем ID маршрута
            return res.json({ routeId });
        } catch (error) {
            console.error('Ошибка при создании маршрута:', error);
            return next(ApiError.internal('Ошибка сервера: ' + error.message));
        }
    }
}

module.exports = new RouteController();
