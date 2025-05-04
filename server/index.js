require('dotenv').config();
const express = require('express');
const { createServer } = require('http');
const setupWebSocket = require('./websocket'); // Импортируем нашу WebSocket-логику
const pool = require('./db_pg');
const cors = require('cors');
const fileUpload = require('express-fileupload');
const router = require('./routes/index');
const errorHandler = require('./middleware/ErrorHandlingMiddleware');
const path = require('path');

const PORT = process.env.PORT || 5000;

// Создаем Express приложение
const app = express();

// Создаем HTTP-сервер на основе Express
const server = createServer(app);

// Middleware
app.use(fileUpload({}));
app.use(cors({
    //origin: ['http://localhost:8080', 'https://unigo-project.vercel.app'],
    origin: ['https://unigo-project.vercel.app'],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
}));
app.use(express.json());
app.use('/static', express.static(path.join(__dirname, 'static')));
app.use('/api', router);
app.use(errorHandler);
console.log('111111');
// Инициализация WebSocket сервера
setupWebSocket(server);
console.log('222222');
// Проверка подключения к БД
const testDBConnection = async () => {
    try {
        const res = await pool.query('SELECT NOW()');
        console.log('Подключение к базе данных успешно:', res.rows[0]);
    } catch (err) {
        console.error('Ошибка подключения к базе данных:', err);
        process.exit(1);
    }
};

// Запуск сервера
const start = async () => {
    try {
        await testDBConnection();
        server.listen(PORT, () => {
            console.log(`HTTP и WebSocket сервер запущен на порту ${PORT}`);
            console.log(`WebSocket доступен по ws://localhost:${PORT}`);
        });
    } catch (e) {
        console.error('Ошибка запуска сервера:', e);
        process.exit(1);
    }
};

// Запуск фоновых задач (если есть)
const startTripStatusJob = require('./jobs/tripStatusJob');
startTripStatusJob();

start();















/*require('dotenv').config();
const express = require('express'); // импортирует модуль express
const pool = require('./db_pg');
const cors = require('cors'); // корс для запросов с браузера
const fileUpload = require('express-fileupload'); // корс для запросов с браузера
const router = require('./routes/index');
const errorHandler = require('./middleware/ErrorHandlingMiddleware');
const path = require('path');

const PORT = process.env.PORT || 5000; // порт, на котором приложение будет работать, полученный из переменного окружения

const app = express(); // создаем объект, вызвав функцию express

app.use(fileUpload({}))

// Настройка CORS (должна быть до всех маршрутов)
app.use(cors({
    origin: 'http://localhost:8080', // Разрешаем запросы с клиента
    methods: ['GET', 'POST', 'PUT', 'DELETE'], // Разрешенные методы
    credentials: true // Разрешить передачу куки и заголовков авторизации
}));

app.use(express.json()); // Парсинг JSON-тела запросов

// Раздача статических файлов (добавлено здесь)
app.use('/static', express.static(path.join(__dirname, 'static')));

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

const startTripStatusJob = require('./jobs/tripStatusJob');
startTripStatusJob();

start();

//const path = require('path');
/*
// Раздача статических файлов
app.use(express.static(path.resolve(__dirname, '../client/UniGo')));

// Обработка всех маршрутов для возврата `index.html`
app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, '../client/UniGo', 'index.html'));
});
*/