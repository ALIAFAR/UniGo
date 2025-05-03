const Router=require('express')
const router=new Router
const chatController=require('../controllers/chatController')
const authMiddleware = require('../middleware/authMiddlewere');

router.post('/create',authMiddleware,chatController.create)
router.get('/get',authMiddleware,chatController.getAll)
router.get('/:id', authMiddleware, chatController.getOne)
router.get('/:id/messages', chatController.getMessages) // Новый роут

module.exports = router