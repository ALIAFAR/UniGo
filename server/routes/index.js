const Router=require('express')
const router=new Router
const userRouter=require('./userRouter')
const carRouter=require('./carRouter')
const tripRouter=require('./tripRouter')
const routeRouter=require('./routeRouter')
const stopRouter=require('./stopRouter')
const bookingRouter=require('./bookingRouter')
const ratingRouter=require('./ratingRouter')
const chatRouter=require('./chatRouter')

router.use('/user',userRouter)
router.use('/car',carRouter)
router.use('/trip',tripRouter)
router.use('/route',routeRouter)
router.use('/stop',stopRouter)
router.use('/chat',chatRouter)
router.use('/booking',bookingRouter)
router.use('/rating',ratingRouter)

module.exports = router