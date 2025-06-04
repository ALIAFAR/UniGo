const Router=require('express')
const router=new Router
const notificationsController = require('../controllers/notificationController');
const authMiddleware = require('../middleware/authMiddlewere');

// Уведомления
router.get('/notifications/:userId', authMiddlewere, notificationsController.getUserNotifications);
router.put('/notifications/:notificationId/read', authMiddlewere, notificationsController.markAsRead);
router.put('/notifications/read-all', authMiddlewere, notificationsController.markAllAsRead);
router.get('/notifications/unread/count', authMiddlewere, notificationsController.getUnreadCount);

module.exports = router;