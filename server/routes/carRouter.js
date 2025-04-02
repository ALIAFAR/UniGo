const Router=require('express')
const router=new Router
const carController=require('../controllers/carController')
const authMiddleware = require('../middleware/authMiddlewere'); 

router.post('/create',authMiddleware,carController.create)
router.get('/profileCar',authMiddleware,carController.getProfileCar)
router.delete('/deleteByNumber/:carNumber', authMiddleware, carController.deleteByNumber);


module.exports = router