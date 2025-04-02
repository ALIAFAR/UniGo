const Router=require('express')
const router=new Router
const chatController=require('../controllers/chatController')

router.post('/',chatController.create)//create trip
router.get('/',chatController.getAll)//get all trip

module.exports = router