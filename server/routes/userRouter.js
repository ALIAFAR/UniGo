const Router=require('express')
const router=new Router
const authMiddleware = require('../middleware/authMiddlewere'); // Проверка токена
const userController=require('../controllers/userController')

router.post('/registration',userController.registration)//регистрация
router.post('/login',userController.login)//авторизация
router.post('/upd_profile_license',authMiddleware,userController.post_license)
router.get('/auth',authMiddleware,userController.check)//проверка: авторизован или нет
router.get('/user',userController.getById)
router.get('/password_check',userController.password_check)
router.get('/get_byFormId',userController.get_byFormId)
router.get('/getUser',authMiddleware,userController.getUser)
router.get('/license_profile',authMiddleware,userController.getUser_license_profile)
router.post('/update-profile', authMiddleware, userController.updateProfile);

module.exports = router