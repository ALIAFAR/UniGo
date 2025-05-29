const Router = require('express');
const router = new Router();
const operatorController = require('../controllers/operatorController');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');

// Создание пользователей из формы (только для админов)
router.post('/create-users', 
  authMiddleware, 
  adminMiddleware, 
  operatorController.create_users
);

// Получение пользователей для проверки
router.get('/users/for-verification', 
  authMiddleware, 
  adminMiddleware, 
  operatorController.getUsersForVerification
);

// Подтверждение пользователя
router.put('/users/:userId/approve', 
  authMiddleware, 
  adminMiddleware, 
  operatorController.approveUser
);

// Отклонение пользователя
router.put('/users/:userId/reject', 
  authMiddleware, 
  adminMiddleware, 
  operatorController.rejectUser
);

// Блокировка пользователя
router.put('/users/:userId/block', 
  authMiddleware, 
  adminMiddleware, 
  operatorController.blockUser
);

// Разблокировка пользователя
router.put('/users/:userId/unblock', 
  authMiddleware, 
  adminMiddleware, 
  operatorController.unblockUser
);

// Получение автомобилей для проверки
router.get('/cars/for-verification', 
  authMiddleware, 
  adminMiddleware, 
  operatorController.getCarsForVerification
);

// Подтверждение автомобиля
router.put('/cars/:carId/approve', 
  authMiddleware, 
  adminMiddleware, 
  operatorController.approveCar
);

// Получение поездок пользователя
router.get('/users/:userId/trips', 
  authMiddleware, 
  adminMiddleware, 
  operatorController.getUserTrips
);

module.exports = router;