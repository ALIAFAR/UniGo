const cron = require('node-cron');
const pool = require('../db_pg'); // путь до базы, один уровень вверх

const startTripStatusJob = () => {
    cron.schedule('* * * * *', async () => {
        try {
            const res = await pool.query(`
                UPDATE trips
                SET trip_status = 'last'
                WHERE trip_status = 'active'
                  AND arrival_time <= NOW()
            `);
            if (res.rowCount > 0) {
                console.log(`Обновлено ${res.rowCount} поездок до 'last'`);
            }
        } catch (err) {
            console.error('Ошибка при обновлении статусов поездок:', err);
        }
    });
};

module.exports = startTripStatusJob;
