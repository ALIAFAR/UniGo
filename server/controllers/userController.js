const ApiError = require('../error/ApiError');
const bcrypt = require('bcryptjs');
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

const uuid = require('uuid')
const path= require('path')
const fs = require('fs');

class UserController {

    async create_img(req, res, next) {
        try {
            const userId = req.user.id; // id из токена
            const { avatar } = req.files; // файл называется 'avatar' в formData
            console.log("1")
            console.log("2",avatar) 
            if (!avatar) {               
                return next(ApiError.badRequest('Файл изображения не найден'));
            }

            let filename = uuid.v4() + ".jpg"; // Генерация уникального имени
            const filePath = path.resolve(__dirname, '..', 'static', filename);
            await avatar.mv(filePath); // Сохраняем файл

            // Обновляем в БД через вызов функции update_user_img
            await pool.query('SELECT update_user_img($1, $2)', [userId, filename]);

            // Возвращаем success + url аватара
            return res.json({
                success: true,
                avatarUrl: `/static/${filename}` // чтобы на фронте правильно подставлять
            });
        } catch (error) {
            console.error(error);
            return next(ApiError.internal('Ошибка при загрузке фото'));
        }
    }

    async get_img(req, res, next) {
        try {
            const userId = req.user.id;
            const result = await pool.query('SELECT img FROM public.users WHERE id = $1', [userId]);
            const user = result.rows[0];
    
            if (!user || !user.img) {
                return res.json({ success: false, message: 'Аватар не найден' });
            }
    
            return res.json({
                success: true,
                avatarUrl: `https://unigo.onrender.com/static/${user.img}`
            });
        } catch (error) {
            console.error(error);
            return next(ApiError.internal('Ошибка при получении фото'));
        }
    }


    async get_all(req, res, next) {
        console.log("passInfo1")
        try {
            // Деструктурируем параметры из запроса
            const { trip_id } = req.query;
            console.log("passInfo2")
            // Проверяем, что обязательный параметр передан
            if (!trip_id) {
                return next(ApiError.badRequest('Не указан ID поездки (trip_id)'));
            }
            console.log("passInfo3")
            // Основной запрос для получения информации о пассажирах
            const { rows: passengers } = await pool.query(
                `SELECT 
                    u.id,
                    u.img,
                    u.birthday,
                    f.surname,
                    f.name,
                    f.department,
                    f.position,
                    u.gender,
                    u.passenger_rating,
                    b.seats_booked
                 FROM users u
                 JOIN forms f ON f.id = u.form_id
                 JOIN bookings b ON b.passenger_id = u.id
                 JOIN trips t ON t.id = b.trip_id
                 WHERE t.id = $1
                 AND b.reservation_status='активен'`,
                [trip_id]
            );
            console.log("passInfo4")
            // Проверяем, найдены ли пассажиры
            if (passengers.length === 0) {
                return res.json({ 
                    success: false, 
                    message: 'Для данной поездки пассажиры не найдены' 
                });
            }
            //hjkjhg
            // Форматируем данные для ответа
            const result = passengers.map(passenger => ({
                id: passenger.id,
                surname: passenger.surname,
                name: passenger.name,
                department: passenger.department,
                position: passenger.position,
                gender: passenger.gender,
                passenger_rating: passenger.passenger_rating,
                seats_booked: passenger.seats_booked,
                birthday: passenger.birthday,
                avatarUrl: passenger.img 
                    ? `https://unigo.onrender.com/static/${passenger.img}`
                    : '/default-avatar.jpg'
            }));
    
            return res.json({
                success: true,
                passengers: result
            });
    
        } catch (error) {
            console.error('Ошибка в get_all:', error);
            next(ApiError.internal('Ошибка сервера при получении данных о пассажирах'));
        }
    }

    async delete_img(req, res, next) {
        try {
            const userId = req.user.id;

            const result = await pool.query('SELECT img FROM public.users WHERE id = $1', [userId]);
            const user = result.rows[0];

            if (!user || !user.img) {
                return next(ApiError.badRequest('Фото не найдено'));
            }

            const filePath = path.resolve(__dirname, '..', 'static', user.img);

            
                

                // Очищаем поле img в базе
                await pool.query('SELECT update_user_img($1, $2)', [userId, null]);

                return res.json({ message: 'Фото успешно удалено' });
            

        } catch (error) {
            console.error(error);
            return next(ApiError.internal('Ошибка при удалении фото'));
        }
    }

    async password_check(req, res, next) {
        try {
            console.log("1")
            // Деструктурируем параметры из запроса
            const { password } = req.query;
            console.log("2")            
            // Проверяем, что все обязательные параметры переданы
            if (!password) {
                return next(ApiError.badRequest('Необходимо указать временный пароль'));
            }
            console.log("3")  
            // Выполняем запрос к функции find_id_by_password
            const result = await pool.query(
                `SELECT find_id_by_password($1) AS user_id`, // Вызываем функцию и получаем user_id
                [password] // Передаем пароль как параметр
            );
            console.log("4")  
            // Извлекаем user_id из результата
            const user_id = result.rows[0].user_id;
            console.log("5")  
            // Если user_id не найден, возвращаем ошибку
            if (!user_id) {
                console.log("Пользователь с таким паролем не найден")
                return next(ApiError.badRequest('Пользователь с таким паролем не найден'));
            }
            console.log("6")  
            console.log(user_id) 
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
    

    async login(req, res, next) {
        try {
            const { login, password } = req.body;
            
            // Проверка на оператора
            if (login === process.env.operator_login && password === process.env.operator_password) {
                const token = generateJwt(1, process.env.operator_login, 'operator');
                return res.json({ 
                    token,
                    role: 'operator' // Добавляем роль в ответ
                });
            }

            if (!login || !password) {
                return next(ApiError.badRequest('Пустые ячейки.'));
            }

            const { rows } = await pool.query(
                `SELECT * FROM users WHERE login = $1`,
                [login]
            );

            if (rows.length === 0) {
                return next(ApiError.badRequest('Пользователь не найден.'));
            }

            const user = rows[0];
            const comparePassword = bcrypt.compareSync(password, user.password);
            if (!comparePassword) {
                return next(ApiError.internal('Неверный пароль.'));
            }

            const token = generateJwt(user.id, user.email, user.role);
            return res.json({ 
                token,
                role: user.role // Добавляем роль в ответ
            });
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

    async get_id_for_chat(req, res, next) {
        try {
            const user_id  =  req.user.id;

            return res.json({ user_id });
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

    async get_driver_profile(req, res, next) {
        try {
            const result = await pool.query(
                'SELECT * FROM driver_profile_information($1)',
                [req.params.id]
            );
    
            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Driver not found' });
            }
    
            const driver = result.rows[0];
            driver.avatarurl = driver.avatarurl 
                ? `${req.protocol}://${req.get('host')}/static/${driver.avatarurl}`
                : `${req.protocol}://${req.get('host')}/static/default-avatar.jpg`;
    
            // Возвращаем чистый объект driver
            res.json(driver);
    
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Server error' });
        }
    }
}

module.exports = new UserController();
