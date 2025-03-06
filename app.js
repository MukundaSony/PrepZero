//modules
require('dotenv').config()
const express = require('express')
const app = express()
const bodyParser = require('body-parser')
const ejs = require('ejs')
const User = require('./models/usermodel')


// declaring passport and session
const flash = require('connect-flash');
const session = require('express-session')
const _ = require("lodash");
const passport = require('passport')
const LocalStrategy = require('passport-local')
const path = require('path')


const rateLimit = require('express-rate-limit')
const mongoSanitize = require('express-mongo-sanitize')
const hpp = require('hpp')
const xss = require('xss-clean')

// setting view engine to ejs
app.set('view engine', 'ejs')

//database configure ("monodb/mongoose")
const mongoose = require('mongoose')
const dbname = "codingplatform"
const dburl = "mongodb+srv://avin:avin@cluster0.fhxczjk.mongodb.net/codingplatform?retryWrites=true&w=majority&appName=Cluster0"

mongoose.connect(dburl,
{useNewUrlParser: true},
{useCreateIndex :true}).then(()=>{
    console.log("connected to database")
})
app.use('/uploads', express.static('uploads'));


const multer = require('multer')


//using middlewares
//app.use(helmet())

app.use(mongoSanitize())
app.use(hpp())
app.use(xss())
app.use(express.static("public"));
app.use(express.json())

app.use(bodyParser.json({ limit: '100mb', parameterLimit: 100000  })); // Adjust the limit as needed
app.use(bodyParser.urlencoded({ limit: '100mb', extended: true, parameterLimit: 100000 }));
/*



*/


//configuring sessions
app.use(session({
    secret: 'this is my secretenviroment file',
    resave : false,
    saveUninitialized: false ,
    secure : true , 
    httpOnly : true
}))

app.use(flash());

app.use((req, res, next) => {
    res.locals.successMessage = req.flash('success');
    next();
});
//using passport middlewares
app.use(passport.initialize());
app.use(passport.session())
const { send, type } = require('express/lib/response');
const { authenticate } = require('passport');
const { result } = require('lodash');
const { buffer } = require('stream/consumers');
passport.use(User.createStrategy());

// passport.use(new LocalStrategy({usernameField : 'email'},User.authenticate()));

passport.use(new LocalStrategy({ usernameField: 'email' }, async (email, password, done) => {
  try {
     
      const user = await User.findOne({ email: email });

     
      if (!user) {
          return done(null, false, { message: 'No user found with this email' });
      }

   
      if (!user.userallowed) {
          return done(null, false, { message: 'Verify your account to log in' });
      }

     
      user.authenticate(password, (err, user, msg) => {
          if (err) {
              return done(err);
          }
          if (!user) {
              return done(null, false, { message: msg || 'Incorrect password' });
          }

        
          return done(null, user);
      });
      
  } catch (err) {
      return done(err);
  }
}));



//using limiter to limit usages

const limiter = rateLimit({
  max : 100 ,
  windows : 60*60*1000,
  message : "crossed the limit"
})
app.use('/',limiter)

//serializing and deserializing passport


passport.serializeUser(function(user, done) {
    done(null, user.id);
  });

  passport.deserializeUser(function(id, done) {
    User.findById(id, function(err, user) {
      done(err, user);
    });
  });



//Routes handler
const home = require('./routes/home')
const dashboard = require('./routes/dashboard');
const admin = require('./routes/admin')
const authenticateing = require('./routes/authenticate')
const profile = require('./routes/profile')
const userauth = require('./routes/userauth')


app.get('/logout', async (req, res, next) => {
  req.logout((err) => {
    if (err) { 
      return next(err); 
    }
    req.session.destroy(() => {
      res.redirect('/');
    });
  });
});
app.get("/check", async (req,res)=>{
  const user = await User.find();
  console.log(user)
})



const storage = multer.diskStorage({
  destination: function (req, file, cb) {
      cb(null, 'intrigity/'); 
  },
  filename: function (req, file, cb) {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, `captured-${uniqueSuffix}${path.extname(file.originalname)}`); 
  }
});


const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (extname && mimetype) {
      return cb(null, true);
  }
  cb(new Error('Only images (JPEG, JPG, PNG) are allowed!'));
};


const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } 
});


const Integrity = require('./models/Integrity');
app.post('/update-integrity', async (req, res) => {
  
  const { examId, userId, eventType } = req.body;
  const eventFieldMap = {
    tabChanges: "tabChanges",
    mouseOuts: "mouseOuts",
    fullscreenExits: "fullscreenExits",
    copyAttempts: "copyAttempts",
    pasteAttempts: "pasteAttempts",
    focusChanges: "focusChanges"
};

if (!eventFieldMap[eventType]) {
    return res.status(400).json({ success: false, message: "Invalid event type." });
}

const updateField = eventFieldMap[eventType];
console.log(eventFieldMap)
try {
    await Integrity.updateOne(
        { examId, userId },
        { 
            $inc: { [updateField]: 1 }, 
            $set: { lastEvent: eventType }
        },
        { upsert: true }  
    );

    res.json({ success: true, message: `Integrity event '${eventType}' updated.` });
} catch (error) {
    console.error("Error updating integrity event:", error);
    res.status(500).json({ success: false, message: "Internal server error." });
}
});

app.post('/save-image', upload.single('image'), (req, res) => {
  if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
  }

  console.log('Image saved successfully:', req.file.path);
  res.json({ success: true, filename: req.file.path });
});

app.use('/',home )
app.use('/dashboard',dashboard)
app.use('/admin' ,admin)
app.use('/authenticate',authenticateing)
app.use('/profile',profile)
app.use('/user' , userauth)


app.all('*', async (req,res,next)=>{

    res.render('pagenotfound')
    next();
})


module.exports = app


