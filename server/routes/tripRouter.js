//поездка
const Router=require('express')
const router=new Router
const tripController=require('../controllers/tripController')
const authMiddleware = require('../middleware/authMiddlewere'); // Проверка токена

router.post('/trip',authMiddleware,tripController.create)//create trip
router.get('/search',authMiddleware,tripController.get_driver_trips)//get all trip
router.get('/check-diver',authMiddleware,tripController.checkDriverStatus)//get all trip
router.get('/searchResult',tripController.search_result)//get all trip
router.put('/cancell/:id',authMiddleware,tripController.cancell_trip)//get all trip
//router.get('/:id',tripController.getOne)//get all trip

module.exports = router