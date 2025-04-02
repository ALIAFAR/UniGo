const jwt = require('jsonwebtoken');
const ApiError = require('../error/ApiError');

module.exports = function (req, res, next) {
    if (req.method === 'OPTIONS') {
        return next(); // Пропуск для preflight-запросов
    }

    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            throw ApiError.unauthorized('Токен не найден.');
        }

        const token = authHeader.split(' ')[1]; // Получаем сам токен
        if (!token) {
            throw ApiError.unauthorized('Некорректный токен.');
        }

        const decoded = jwt.verify(token, process.env.SECRET_KEY); // Проверяем токен
        req.user = decoded; // Сохраняем данные из токена в req.user
        next(); // Переходим к следующему middleware/контроллеру
    } catch (error) {
        next(ApiError.unauthorized('Не авторизован'));
    }
};
