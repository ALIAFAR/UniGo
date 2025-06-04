const Router=require('express')
const router=new Router
const notificationsController = require('../controllers/notificationController');
const authMiddleware = require('../middleware/authMiddlewere');

// Уведомления
router.get('/:userId', authMiddleware, notificationsController.getUserNotifications);
router.put('/:notificationId/read',authMiddleware, notificationsController.markAsRead);
router.put('/read-all', authMiddleware, notificationsController.markAllAsRead);
router.get('/unread/count',authMiddleware, notificationsController.getUnreadCount);

module.exports = router;