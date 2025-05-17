const Router=require('express')
const router=new Router
const userRouter=require('./userRouter')
const carRouter=require('./carRouter')
const tripRouter=require('./tripRouter')
const routeRouter=require('./routeRouter')
const stopRouter=require('./stopRouter')
const bookingRouter=require('./bookingRouter')
const ratingRouter=require('./ratingRouter')
const chatRouter=require('./chatRouter')
const authRouter=require('./authRoutes')
const pool = require('../db_pg'); // Подключаем модуль для работы с БД

router.use('/user',userRouter)
router.use('/car',carRouter)
router.use('/trip',tripRouter)
router.use('/route',routeRouter)
router.use('/stop',stopRouter)
router.use('/chat',chatRouter)
router.use('/booking',bookingRouter)
router.use('/rating',ratingRouter)
router.use('/auth',authRouter)

// Роут для ручного обновления статусов
router.get('/update-trips-status', async (req, res) => {
    try {
        const result = await pool.query(`
        UPDATE trips 
        SET trip_status = 'last'
        WHERE trip_status = 'active' 
        AND arrival_time <= NOW()
        `);
        console.log(`Обновлено поездок: ${result.rowCount}`);
        res.json({ 
        success: true, 
        updated: result.rowCount,
        message: 'Статусы поездок обновлены'
        });
    } catch (err) {
        console.error('Ошибка при обновлении:', err);
        res.status(500).json({ 
        success: false,
        error: err.message 
        });
    }
});

router.post('/update-forms', async (req, res) => {
    try {
        await pool.query(`
        INSERT INTO public.forms (surname, name, middlename, password, department, "position", status)
VALUES
    -- Девушки
    ('Иванова', 'Анна', 'Сергеевна', 'AnNVa12!@', 'IT-институт', 'Студент', true),
    ('Петрова', 'Екатерина', 'Алексеевна', 'Kat#V2023', 'ФТТ', 'Студент', false),
    
    -- Парни
    ('Смирнов', 'Дмитрий', 'Игоревич', 'DimVa88$%', 'ГНФ', 'Студент', true),
    ('Кузнецов', 'Александр', 'Владимирович', 'AlexV*1234', 'ТФ', 'Студент', true),
    ('Попов', 'Михаил', 'Олегович', 'MishVa5^&', 'Аси', 'Студент', false);

        `);
        console.log(`Обновление форм: ${result.rowCount}`);
    } catch (err) {
        console.error('Ошибка при обновлении:', err);
    }
});

module.exports = router