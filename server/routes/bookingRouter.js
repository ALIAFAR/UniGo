const Router=require('express')
const router=new Router
const bookingController=require('../controllers/bookingController')

router.post('/',bookingController.create)//create trip
router.get('/',bookingController.getAll)//get all trip
router.get('/::id',bookingController.getOne)//get all trip

module.exports = router