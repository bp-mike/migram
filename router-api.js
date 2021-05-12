const apiRouter = require('express').Router()
const userController = require('./controllers/userController')
const postController = require('./controllers/postController')
const followController = require('./controllers/followController')
const cors = require('cors')

apiRouter.use(cors())

apiRouter.post('/login', userController.apiLogin)
apiRouter.post('/create-post', postController.apiCreate)
apiRouter.delete('/post/:id', postController.apiDelete)
apiRouter.get('/postsByAuthor/:username', userController.apiGetPostsByUsername)
// apiRouter.delete('/post/:id', userController.apiMustBeLoggedIn, postController.apiDelete)
// apiRouter.post('/create-post', userController.apiMustBeLoggedIn, postController.apiCreate)

module.exports = apiRouter
