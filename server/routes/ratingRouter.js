const Router=require('express')
const router=new Router
const ratingController=require('../controllers/ratingController')

router.post('/',ratingController.create)//create trip
router.get('/',ratingController.getAll)//get all trip

module.exports = router