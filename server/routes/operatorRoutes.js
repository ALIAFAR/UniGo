const Router = require('express');
const router = new Router();
const operatorController = require('../controllers/operatorController');
const authMiddleware = require('../middleware/authMiddlewere');
const adminMiddleware = require('../middleware/adminMiddleware');

// Создание пользователей из формы (только для админов)
router.post('/create-users', 
  authMiddleware, 
  adminMiddleware, 
  operatorController.create_users
);

// Пользователи
router.get('/users', 
  authMiddleware, 
  adminMiddleware, 
  operatorController.getUsers
);

router.put('/users/:userId/approve', 
  authMiddleware, 
  adminMiddleware, 
  operatorController.approveUser
);

router.put('/users/:userId/reject', 
  authMiddleware, 
  adminMiddleware, 
  operatorController.rejectUser
);

router.delete('/users/:userId', 
  authMiddleware, 
  adminMiddleware, 
  operatorController.deleteUser
);

router.put('/users/:userId/block', 
  authMiddleware, 
  adminMiddleware, 
  operatorController.blockUser
);

router.get('/users/:userId/trips', 
  authMiddleware, 
  adminMiddleware, 
  operatorController.getUserTrips
);

// Автомобили
router.get('/cars', 
  authMiddleware, 
  adminMiddleware, 
  operatorController.getCars
);

router.put('/cars/:carId/approve', 
  authMiddleware, 
  adminMiddleware, 
  operatorController.approveCar
);

router.delete('/cars/:carId', 
  authMiddleware, 
  adminMiddleware, 
  operatorController.rejectCar
);

module.exports = router;