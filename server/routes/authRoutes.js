const Router = require('express');
const router = new Router();
const authController = require('../controllers/authController');
const resetPasswordLimiter = require('../middleware/rateLimitMiddleware'); // Импорт лимитера

router.post('/request-password-reset', resetPasswordLimiter, authController.requestPasswordReset);
router.get('/validate-reset-token/:token', authController.validateResetToken);
router.post('/reset-password', authController.resetPassword);

module.exports = router;