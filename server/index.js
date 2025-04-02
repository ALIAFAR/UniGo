require('dotenv').config();
const express = require('express'); // импортирует модуль express
const pool = require('./db_pg');
const cors = require('cors'); // корс для запросов с браузера
const router = require('./routes/index');
const errorHandler = require('./middleware/ErrorHandlingMiddleware');

const PORT = process.env.PORT || 5000; // порт, на котором приложение будет работать, полученный из переменного окружения

const app = express(); // создаем объект, вызвав функцию express

// Настройка CORS (должна быть до всех маршрутов)
app.use(cors({
    origin: 'http://localhost:8080', // Разрешаем запросы с клиента
    methods: ['GET', 'POST', 'PUT', 'DELETE'], // Разрешенные методы
    credentials: true // Разрешить передачу куки и заголовков авторизации
}));

app.use(express.json()); // Парсинг JSON-тела запросов
app.use('/api', router); // Подключение маршрутов

// Обработка ошибок, последний middleware
app.use(errorHandler);

const testDBConnection = async () => {
    try {
        const res = await pool.query('SELECT NOW()');
        console.log('Подключение к базе данных успешно:', res.rows[0]);
    } catch (err) {
        console.error('Ошибка подключения к базе данных:', err);
        process.exit(1); // Завершаем приложение, если нет подключения
    }
};

const start = async () => {
    try {
        await testDBConnection(); // Проверяем подключение к БД
        app.listen(PORT, () => console.log(`Сервер запущен на порту ${PORT}`));
    } catch (e) {
        console.error('Ошибка запуска сервера:', e);
        process.exit(1); // Завершаем приложение при ошибке запуска
    }
};

const path = require('path');
/*
// Раздача статических файлов
app.use(express.static(path.resolve(__dirname, '../client/UniGo')));

// Обработка всех маршрутов для возврата `index.html`
app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, '../client/UniGo', 'index.html'));
});
*/

start();