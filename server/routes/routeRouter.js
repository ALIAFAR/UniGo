const Router=require('express')
const router=new Router
const routeController=require('../controllers/routeController')

router.post('/route',routeController.create)//get all trip

module.exports = router