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

router.use('/user',userRouter)
router.use('/car',carRouter)
router.use('/trip',tripRouter)
router.use('/route',routeRouter)
router.use('/stop',stopRouter)
router.use('/chat',chatRouter)
router.use('/booking',bookingRouter)
router.use('/rating',ratingRouter)

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

module.exports = router