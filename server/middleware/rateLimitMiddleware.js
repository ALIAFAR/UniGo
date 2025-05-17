const rateLimit = require('express-rate-limit');

const resetPasswordLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 минут
    max: 3, // максимум 3 запроса
    message: 'Слишком много запросов на сброс пароля. Пожалуйста, попробуйте позже.',
    handler: (req, res) => {
        console.warn(`Too many reset password requests from IP: ${req.ip}`);
        res.status(429).json({ message: 'Слишком много запросов. Пожалуйста, попробуйте позже.' });
    }
});

module.exports = resetPasswordLimiter;