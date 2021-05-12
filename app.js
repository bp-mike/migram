const express = require('express')
const app = express()
const flash = require('connect-flash')
const session = require('express-session')
const MongoStore = require('connect-mongo')(session)
const markdown = require('marked')
const sanitizeHTML = require('sanitize-html')
const csrf = require('csurf')

app.use(express.urlencoded({extended: false}))
app.use(express.json())

app.use('/api', require('./router-api'))
//npm install connect-mongo@3.2.0
//____or
// const MongoStore = require("connect-mongo").default;
//
// //session configuration
// const mongoStore = MongoStore.create({
//   mongoUrl: url,
//   collectionName: "sessions",
// });

let sessionOptions = session({
  secret: "js is ok",
  store: new MongoStore({client: require('./db')}),
  resave: false,
  saveUninitialized:false,
  cookie:{maxAge: 1000 * 60 * 60 *24, httpOnly: true }
})

app.use(sessionOptions)
app.use(flash())

app.use((req, res, next)=>{
  //___ make markdown function available in the ejs templates
  res.locals.filterUserHTML = (content)=>{
    return sanitizeHTML(markdown(content), {allowedTags: ['p', 'br', 'ul', 'ol', 'li', 'strong','bold', 'i', 'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6' ], allowsAttributes: {}})
  }

  //___ make flash messages available for all templates
  res.locals.errors = req.flash('errors')
  res.locals.success = req.flash('success')
  //___ make current user is available on the req object
    if(req.session.user){
      req.visitorId = req.session.user._id
    }else{
      req.visitorId = 0
    }
  //______ make user session data available from within view templates
  res.locals.user = req.session.user
  next()
})

const router = require('./router')
console.log(router);


app.use(express.static('public'))
app.set('views', 'views')
app.set('view engine', 'ejs')

app.use(csrf())
app.use((req, res, next) =>{
  res.locals.csrfToken = req.csrfToken()
  next()
})

app.use('/', router)

app.use((err, req, res, next) =>{
  if(err){
    if(err.code == "EBADCSRFTOKEN"){
      req.flash('errors', "Cross site request forgery detected")
      res.session.save(() => res.redirect('/'))
    }else{
      res.render('404')
    }
  }
})

const server = require('http').createServer(app)
const io = require('socket.io')(server)

io.use((socket, next)=>{
  sessionOptions(socket.request, socket.request.res, next)
})

io.on('connection', (socket) =>{
  if(socket.request.session.user){
    let user = socket.request.session.user

    socket.emit('welcome', {username: user.username, avatar:user.avatar})
    socket.on('chatMessageFromBrowser', (data) =>{
      socket.broadcast.emit('chatMessageFromServer', {message: sanitizeHTML(data.message, {allowedTags: [], allowsAttributes: {}}), username: user.username, avatar: user.avatar})
    })
  }
})
// app.listen(3000)
// module.exports = app
module.exports = server
