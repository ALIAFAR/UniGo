const Router=require('express')
const router=new Router
const bookingController=require('../controllers/bookingController')
const authMiddleware = require('../middleware/authMiddlewere');

router.post('/create',authMiddleware,bookingController.create)//create trip
router.get('/get-booked',authMiddleware,bookingController.get_booked_trips)//get all trip
router.put('/cancell/:id',authMiddleware,bookingController.cancell_book)//get all trip

module.exports = router