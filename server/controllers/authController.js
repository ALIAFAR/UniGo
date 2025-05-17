const bcrypt = require('bcryptjs');

const crypto = require('crypto');
const nodemailer = require('nodemailer');
const  pool  = require('../db_pg'); // Подключение к базе через pg
const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');

// Настройка rate limiting
/*const resetPasswordLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 минут
    max: 3, // максимум 3 запроса
    message: 'Слишком много запросов на сброс пароля. Пожалуйста, попробуйте позже.',
    handler: (req, res) => {
        logger.warn(`Too many reset password requests from IP: ${req.ip}`);
        res.status(429).json({ message: 'Слишком много запросов. Пожалуйста, попробуйте позже.' });
    }
});*/

// Генерация токена
const generateResetToken = () => {
    return crypto.randomBytes(32).toString('hex');
};

// Отправка email
const sendResetEmail = async (email, token) => {
    console.log("reset1")
    const transporter = nodemailer.createTransport({
        service: process.env.EMAIL_SERVICE,
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

    await transporter.sendMail({
        from: process.env.EMAIL_FROM,
        to: email,
        subject: 'Сброс пароля',
        html: `
            <p>Вы запросили сброс пароля. Нажмите на ссылку ниже, чтобы установить новый пароль:</p>
            <a href="${resetUrl}">${resetUrl}</a>
            <p>Ссылка действительна в течение 1 часа.</p>
        `
    });
};

// Запрос на сброс пароля
exports.requestPasswordReset = async (req, res) => {
    console.log("reset2")
    try {
        const { email } = req.body;

        // Проверка существования пользователя
        const userResult = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
        if (userResult.rows.length === 0) {
            logger.info(`Password reset request for non-existent email: ${email}`);
            return res.status(200).json({ message: 'Если email существует, письмо будет отправлено' });
        }

        const userId = userResult.rows[0].id;

        // Удаление старых токенов для этого пользователя
        await pool.query('DELETE FROM password_reset_tokens WHERE user_id = $1', [userId]);

        // Создание нового токена
        const token = generateResetToken();
        const expiresAt = new Date(Date.now() + 3600000); // 1 час

        await pool.query(
            'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
            [userId, token, expiresAt]
        );

        // Отправка email
        await sendResetEmail(email, token);

        logger.info(`Password reset token generated for user: ${userId}`);
        res.status(200).json({ message: 'Письмо с инструкциями отправлено на ваш email' });
    } catch (error) {
        logger.error(`Error in password reset request: ${error.message}`);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
};

// Проверка токена
exports.validateResetToken = async (req, res) => {
    console.log("reset3")
    try {
        const { token } = req.params;

        const result = await pool.query(
            'SELECT * FROM password_reset_tokens WHERE token = $1 AND used = FALSE AND expires_at > NOW()',
            [token]
        );

        if (result.rows.length === 0) {
            return res.status(400).json({ message: 'Недействительный или просроченный токен' });
        }

        res.status(200).json({ valid: true });
    } catch (error) {
        logger.error(`Error validating reset token: ${error.message}`);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
};

// Установка нового пароля
exports.resetPassword = async (req, res) => {
    console.log("reset4")
    try {
        const { token, newPassword } = req.body;

        // Проверка сложности пароля
        if (!isPasswordStrong(newPassword)) {
            return res.status(400).json({ message: 'Пароль должен содержать минимум 8 символов, включая цифры и специальные символы' });
        }

        // Поиск токена
        const tokenResult = await pool.query(
            'SELECT * FROM password_reset_tokens WHERE token = $1 AND used = FALSE AND expires_at > NOW()',
            [token]
        );

        if (tokenResult.rows.length === 0) {
            return res.status(400).json({ message: 'Недействительный или просроченный токен' });
        }

        const resetToken = tokenResult.rows[0];
        const userId = resetToken.user_id;

        // Хеширование нового пароля
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Обновление пароля пользователя
        await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, userId]);

        // Помечаем токен как использованный
        await pool.query('UPDATE password_reset_tokens SET used = TRUE WHERE id = $1', [resetToken.id]);

        logger.info(`Password successfully reset for user: ${userId}`);
        res.status(200).json({ message: 'Пароль успешно изменен' });
    } catch (error) {
        logger.error(`Error resetting password: ${error.message}`);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
};

// Проверка сложности пароля
function isPasswordStrong(password) {
    const minLength = 8;
    const hasNumber = /\d/;
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/;
    
    return password.length >= minLength && 
           hasNumber.test(password) && 
           hasSpecialChar.test(password);
}