const ApiError = require('../error/ApiError');

module.exports = function (req, res, next) {
    try {
        // Проверяем, что пользователь является администратором
        // В реальном приложении здесь должна быть проверка роли пользователя
        // Например, из токена или из базы данных
        if (!req.user.role == 'operator') {
            return next(ApiError.forbidden('Доступ запрещен. Требуются права администратора'));
        }
        
        next();
    } catch (e) {
        return next(ApiError.unauthorized('Ошибка проверки прав доступа'));
    }
};