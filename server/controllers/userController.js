const ApiError = require('../error/ApiError');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db_pg'); // Подключение к базе через pg

// Функция генерации JWT
const generateJwt = (id, email, role) => {
    return jwt.sign(
        { id, email, role },
        process.env.SECRET_KEY,
        { expiresIn: '24h' }
    );
};

class UserController {

    async password_check(req, res, next) {
        try {
            // Деструктурируем параметры из запроса
            const { password } = req.query;
    
            // Проверяем, что все обязательные параметры переданы
            if (!password) {
                return next(ApiError.badRequest('Необходимо указать временный пароль'));
            }
    
            // Выполняем запрос к функции find_id_by_password
            const result = await pool.query(
                `SELECT find_id_by_password($1) AS user_id`, // Вызываем функцию и получаем user_id
                [password] // Передаем пароль как параметр
            );
    
            // Извлекаем user_id из результата
            const user_id = result.rows[0].user_id;
    
            // Если user_id не найден, возвращаем ошибку
            if (!user_id) {
                return next(ApiError.badRequest('Пользователь с таким паролем не найден'));
            }
    
            // Возвращаем найденный user_id
            return res.json({ user_id });
        } catch (error) {
            // Обрабатываем возможные ошибки
            next(ApiError.internal('Ошибка при проверке временного пароля: ' + error.message));
        }
    }

    async get_byFormId(req, res, next) {
        try {
            // Деструктурируем параметры из запроса
            const { user_id } = req.query;
    
            // Проверяем, что все обязательные параметры переданы
            if (!user_id) {
                return next(ApiError.badRequest('FormID unfounded'));
            }
    
            // Выполняем запрос к функции get_user_info_by_id
            const result = await pool.query(
                `SELECT * FROM get_user_info_by_id($1)`, // Вызываем функцию и получаем все поля
                [user_id] // Передаем user_id как параметр
            );
    
            // Извлекаем данные пользователя из результата
            const user_data = result.rows[0];
    
            // Если данные не найдены, возвращаем ошибку
            if (!user_data) {
                return next(ApiError.badRequest('Пользователь с таким id не найден'));
            }
    
            // Возвращаем найденные данные пользователя
            return res.json(user_data);
        } catch (error) {
            // Обрабатываем возможные ошибки
            next(ApiError.internal('Ошибка при получении данных: ' + error.message));
        }
    }

    // Регистрация
    async registration(req, res, next) {
        try {
            // Деструктурируем параметры из запроса
            const { form_id, phone_number, email, birthday, login, password, gender } = req.body;
    
            // Проверяем, что все обязательные поля переданы
            if (!form_id || !phone_number || !email || !birthday || !login || !password || gender === undefined) {
                return next(ApiError.badRequest('Необходимо заполнить все обязательные поля.'));
            }
    
            // Хэшируем пароль перед отправкой в базу
            const hashPassword = await bcrypt.hash(password, 5);
    
            // Вызов функции insert_user_data для добавления пользователя
            const { rows } = await pool.query(
                `SELECT insert_user_data($1, $2, $3, $4, $5, $6, $7) AS new_user_id`,
                [form_id, phone_number, email, birthday, login, hashPassword, gender]
            );
    
            // Извлекаем ID нового пользователя
            const newUserId = rows[0].new_user_id;
    
            // Если ID пользователя успешно получен, создаем JWT токен
            const user = { id: newUserId, email, login, role: 'user' }; // Роль по умолчанию
            const token = generateJwt(user.id, user.email, user.role);
    
            // Возвращаем токен
            return res.json({ token });
        } catch (error) {
            console.error('Ошибка при регистрации:', error);
    
            // Обработка ошибок уникальности (например, дублирование email или login)
            if (error.code === '23505') { // Код ошибки уникальности в PostgreSQL
                return next(ApiError.badRequest('Пользователь с таким email или логином уже существует.'));
            }
    
            return next(ApiError.internal('Ошибка сервера: ' + error.message));
        }
    }
    
    async getUser(req, res, next) {
        try {
            const userId = req.user.id; // Получаем ID пользователя из запроса
    
            // Выполняем SQL-запрос, вызывая функцию get_user_by_id
            const result = await pool.query(
                'SELECT * FROM public.get_profileData($1)',
                [userId]
            );
    
            // Если данные найдены
            if (result.rows.length > 0) {
                const userData = result.rows[0];
    
                // Убираем пароль из ответа (для безопасности)
                delete userData.password;
    
                // Отправляем данные клиенту
                res.json({ success: true, user: userData });
            } else {
                // Если пользователь не найден
                res.status(404).json({ success: false, message: 'Пользователь не найден' });
            }
        } catch (error) {
            console.error('Ошибка при получении данных пользователя:', error);
            next(ApiError.internal('Ошибка при получении данных пользователя'));
        }
    }

    async getUser_license_profile(req, res, next) {
        try {
            const userId = req.user.id; // Получаем ID пользователя из запроса
    
            // Выполняем SQL-запрос, вызывая функцию get_user_by_id
            const result = await pool.query(
                'SELECT * FROM public.getUser_license_profile($1)',
                [userId]
            );
    
            // Если данные найдены
            if (result.rows.length > 0) {
                const userlicense = result.rows[0];
    
                // Отправляем данные клиенту
                res.json({ success: true, user: userlicense });
            } else {
                // Если пользователь не найден
                res.status(404).json({ success: false, message: 'Пользователь не найден' });
            }
        } catch (error) {
            console.error('Ошибка при получении данных пользователя:', error);
            next(ApiError.internal('Ошибка при получении данных пользователя'));
        }
    }


    // Обновление профиля
    async updateProfile(req, res, next) {
        try {
            const userId = req.user.id; // Получаем user_id из авторизованного пользователя
    
            // Извлекаем данные из тела запроса
            const {
                gender, // Пол (boolean)
                dob,    // Дата рождения (date)
                phone,  // Номер телефона (varchar(12))
                email   // Email (varchar(100))
            } = req.body;
    
            // Вызов функции updateProfile в базе данных
            await pool.query(
                `SELECT public.updateProfile($1, $2, $3, $4, $5)`,
                [userId, gender, dob, phone, email]
            );
    
            // Возвращаем успешный ответ
            return res.json({ message: 'Профиль успешно обновлен.' });
        } catch (error) {
            // Обработка ошибок
            return next(ApiError.internal('Ошибка сервера: ' + error.message));
        }
    }
    

    // Авторизация
    async login(req, res, next) {
        try {
            const { login, password } = req.body;

            if(!login||!password){
                return next(ApiError.badRequest('ПУстые ячейки.'));
            }

            const { rows } = await pool.query(
                `SELECT * FROM users WHERE login = $1`,
                [login]
            );

            if (rows.length === 0) {
                return next(ApiError.badRequest('Пользователь нефор не найден.'));
            }

            const user = rows[0];
            const comparePassword = bcrypt.compareSync(password, user.password);
            if (!comparePassword) {
                return next(ApiError.internal('Неверный пароль.'));
            }

            const token = generateJwt(user.id, user.email, user.role);
            return res.json({ token });
        } catch (error) {
            return next(ApiError.internal('Ошибка сервера: ' + error.message));
        }
    }

    async post_license(req, res, next) {
        try {
            const user_id  =  req.user.id;;
            const { licenseNumber, licenseIssueDate } = req.body;
    
            // Вызываем SQL-функцию для обновления лицензии
            await pool.query(
                `SELECT public.post_license($1, $2, $3)`,
                [user_id, licenseNumber, licenseIssueDate]
            );

            return res.json({ message: 'Лицензия успешно обновлена' });
        } catch (error) {
            return next(ApiError.internal('Ошибка сервера: ' + error.message));
        }
    }

    // Проверка авторизации
    async check(req, res) {
        const token = generateJwt(req.user.id, req.user.email, req.user.role);
        return res.json({ token });
    }

    // Получение пользователя по ID
    async getById(req, res, next) {
        try {
            const { driver_id } = req.query;

            if (!driver_id) {
                return next(ApiError.badRequest('Не найден ID пользователя.'));
            }

            const { rows } = await pool.query(
                `SELECT * FROM users WHERE id = $1`,
                [driver_id]
            );

            if (rows.length === 0) {
                return next(ApiError.badRequest('Пользователь не найден.'));
            }

            return res.json(rows[0]);
        } catch (error) {
            next(ApiError.internal('Ошибка при получении пользователя по ID: ' + error.message));
        }
    }
}

module.exports = new UserController();
