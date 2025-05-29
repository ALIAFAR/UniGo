const ApiError = require('../error/ApiError');
const pool = require('../db_pg'); // Подключение к базе через pg

class OperatorController{
    async create_users(req, res, next) {
        try {
            const usersData = req.body.data; // Получаем массив пользователей из тела запроса
            
            // Проверяем, что данные получены
            if (!usersData || !Array.isArray(usersData)) {
                return next(ApiError.badRequest('Неверный формат данных. Ожидается массив пользователей.'));
            }

            // Подготавливаем SQL запрос для вставки всех пользователей одной транзакцией
            const client = await pool.connect();
            
            try {
                await client.query('BEGIN'); // Начинаем транзакцию
                
                // Подготавливаем запрос для каждого пользователя
                for (const user of usersData) {
                    const { surname, name, middlename, password, department, position } = user;
                    
                    await client.query(
                        `INSERT INTO forms (surname, name, middlename, password, department, position) 
                        VALUES ($1, $2, $3, $4, $5, $6)`,
                        [surname, name, middlename, password, department, position]
                    );
                }
                
                await client.query('COMMIT'); // Подтверждаем транзакцию
                
                return res.json({ 
                    success: true,
                    message: `Успешно добавлено ${usersData.length} пользователей`
                });
                
            } catch (err) {
                await client.query('ROLLBACK'); // Откатываем при ошибке
                throw err;
            } finally {
                client.release(); // Освобождаем клиента
            }
            
        } catch (error) {
            console.error('Ошибка при создании пользователей:', error);
            return next(ApiError.internal('Ошибка при сохранении пользователей в базу данных'));
        }
    }

    
}

module.exports=new OperatorController()