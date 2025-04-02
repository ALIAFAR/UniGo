const Router=require('express')
const router=new Router
const stopController=require('../controllers/stopController')

router.post('/stop',stopController.create)


module.exports = router