const Router=require('express')
const router=new Router
const bookingController=require('../controllers/operatorController')
const authMiddleware = require('../middleware/authMiddlewere');

router.post('/create-users',bookingController.create_users)

module.exports = router