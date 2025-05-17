const cron = require('node-cron');
const { pool } = require('../db_pg'); 
const logger = require('../utils/logger');

// Очистка старых токенов каждый день в 3:00
cron.schedule('0 3 * * *', async () => {
    try {
        const result = await pool.query(
            'DELETE FROM password_reset_tokens WHERE expires_at < NOW() OR used = TRUE'
        );
        logger.info(`Cleaned up ${result.rowCount} expired password reset tokens`);
    } catch (error) {
        logger.error(`Error cleaning up reset tokens: ${error.message}`);
    }
});

module.exports = cron;