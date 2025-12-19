//--------------------------------------------------------------------
//Required Modules
//--------------------------------------------------------------------
const express = require('express');
const hbs = require('hbs');
const path = require('path');
const app = express();
const session = require('express-session');  //No longer need cookie-parser
const SQLiteStore = require('./modules/session-store');
const authRoutes = require('./routes/auth');
const { requireAuth } = require('./modules/auth-middleware');
const db = require('./modules/database');

//Interface for module
const PORT = process.env.PORT || 3498;

//--------------------------------------------------------------------
//In-Memory Storage --REMOVE?///
//--------------------------------------------------------------------

const users = [];
let nextId = 1;
const comments = [];
const sessions = [];

//--------------------------------------------------------------------
//Set up Handlebars
//--------------------------------------------------------------------
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

// Helper to check equality
hbs.registerHelper('eq', function(a, b) {
  return a === b;
});

//Register partials directory
hbs.registerPartials(path.join(__dirname, 'views', 'partials'));

//--------------------------------------------------------------------
//Middleware
//--------------------------------------------------------------------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.set('trust proxy',1);

// Serve static files from the 'public' directory
app.use(express.static('public'));


// Session configuration with SQLite store
const sessionStore = new SQLiteStore({
  db: path.join(__dirname, 'sessions.db'),
  table: 'sessions'
});

app.use(session({
  store: sessionStore,
  secret: process.env.SESSION_SECRET || 'change-this-secret-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: true, // True = HTTPS
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Routes
app.use('/api/auth', authRoutes);

//Login State to help nav partials
app.use((req, res, next) => {
    res.locals.isLoggedIn = req.session.isLoggedIn || false;
    res.locals.username = req.session.username || null;
    res.locals.display_name = req.session.display_name || null;
    next();
});

//--------------------------------------------------------------------
//Health/Test Routes

/* Nginx will handle static file serving --> app.use(express.static('public'));
    API Routes-- > don't include '/api' in routes because nginx strips it when forwarding
    nginx receives: http://localhost/api/users & forwards to: http://backend-nodejs:3000/users (without /api)*/

//--------------------------------------------------------------------

app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy',
        service: 'nodejs-backend'
    });
});

//Test
app.get('/test', (req, res) => {
  res.render('home', {
    title: 'Handlebars Test',
    message: 'If you see this, Handlebars is working properly.'
  });
});

//--------------------------------------------------------------------
//GET Routes
//--------------------------------------------------------------------

//Homepage
app.get('/', (req, res) => {
   
    //Guest object to act as default if there is no session
     let user = { 
        name: "Guest",
        isLoggedIn: false,
        loginTime: null,
        visitCount: 0
    }; 

    // Check if user is logged in via session
    if (req.session.isLoggedIn) {
        console.log('succesfully pulled session');
        user = {
            name: req.session.username,
            display_name: req.session.display_name,
            isLoggedIn: true,
            loginTime: req.session.loginTime,
            visitCount: req.session.visitCount || 0
        };
        
        // Increment visit count
        req.session.visitCount = (req.session.visitCount || 0) + 1;
    }
   
    //Load home page with specific user
    res.render('home', {
        title: 'Welcome to Wild West Forum', 
        user: user
    });
});

//Registration page
app.get('/register', (req, res) => {
    res.render('register', { title: 'Register' });
});

// Login page
app.get('/login', (req, res) => {

    //Error and Success Messages
    let errorMessage = null;
    let registerMessage = null;

    if (req.query.error === '1') {
        errorMessage = "Invalid username or password"
    }

    if (req.query.registered === '1') {
        registerMessage = "Successfully registered! Log in."
    }
    
    res.render('login', { 
        title: 'Login',
        error: errorMessage,
        success: registerMessage
    });
});

// Comments page
app.get('/comments', (req, res) => {
    // Default user is guest
    let user = {
        name: "Guest",
        isLoggedIn: false
    };

    // If logged in, use session info
    if (req.session.isLoggedIn) {
        user = {
            name: req.session.username,
            isLoggedIn: true
        };
    }

  // FETCH COMMENTS FROM DB WITH DISPLAY NAME
    const comments = db.prepare(`
        SELECT
        comments.text,
        comments.created_at AS createdAt,
        users.display_name
        FROM comments
        JOIN users ON comments.user_id = users.id
        ORDER BY comments.created_at DESC
    `).all();

    res.render('comments', { title: 'Comments', 
        comments,
        user 
    });
});

// New comment form
app.get('/comment/new', (req, res) => {
    let user = { name: "Guest", isLoggedIn: false };
    if (req.session.isLoggedIn) {
        user = { name: req.session.username, isLoggedIn: true };
    }

    res.render('new-comment', { 
        title: 'New Comment',
        user
    });
});

// Protected route example (doing this manually by sending)
app.get('/api/protected', requireAuth, (req, res) => {
  res.send(`Protected route that needs authentication. User: ${req.session.username} ID: ${req.session.userId}`);
});

//--------------------------------------------------------------------
//POST Routes
//--------------------------------------------------------------------

//Register new user
app.post('/register', async (req,res) => {
    const { username, password } = req.body;
    try {
        const hash = await hashPassword(req.body.password);
        await saveUser(req.body.username, hash);
        res.send('User registered');
    } catch (error) {
        return res.render('register', {
            title: 'Register',
            error: error
        });
    }

    /*
    BLOCK OUT JSON
    //Validiate information
    if (!username || !password) {
        return res.status(400).json({
            error: 'Username and password are required'
        });
    }

    const existingUser = users.find(u => u.username === username);
    if (existingUser) {
        return res.status(409).json({
            error: 'Username already exists'
        });
    }
    */
    const existingUser = users.find(u => u.username === username);
    if (existingUser) {
       return res.render('register', {
            title: 'Register',
            error: 'Username already exists'
        });
    }

    //Create new user
    const newUser = {
        id: nextId++,
        username,
        password,
        display_name: req.body.display_name,
        email: req.body.email,
        createdAt: new Date().toISOString()
    };

    users.push(newUser);

    //Redirect to login page after registration
    res.redirect('/login?registered=1');

});

//Login
app.post('/login', (req, res) => {

    //if works, authenticate session cookie!
    //Make sure username and password are correct/ exists
    
    const username = req.body.username;
    const password = req.body.password;

    //Retrieve specific user
    const user = users.find( u => u.username === username && u.password === password);
    
    // Authentication
    if (user) {
        // Set session data
        req.session.isLoggedIn = true;
        req.session.userId = user.id;
        req.session.username = user.username;
        req.session.loginTime = new Date().toISOString();
        req.session.visitCount = 0;
        req.session.display_name = user.display_name;
        req.session.email = user.email;
        
        console.log(`User ${username} logged in at ${req.session.loginTime}`);
        res.redirect('/');
    } else {
        res.redirect('/login?error=1');
    }
});

//Logout
app.post('/logout', (req, res) => {
    //Store username before session is destroyed to avoid 502Err / Undefined User Err
    const username = req.session.username;

    req.session.destroy((err) => {
        if (err) {
            console.log('Error destroying session:', err);
            res.redirect('/');
        }
    
        console.log(`User ${username} logged out.`);
        res.clearCookie('connect.sid');   //Clear session cookie
        res.redirect('/login'); //Redirect to login page

    });

});
    

//Comment
app.post('/comments', (req, res) => {
    //Make sure flag and valid session object REVIEW

    //Check if user is logged in
    if (!req.session.isLoggedIn) {
        return res.render('login', { error: 'You must be logged in to post a comment.' });
    }

    const { text } = req.body;
    if (!text || text.trim() === '') {
        return res.render('new-comment', { 
            error: 'Comment cannot be empty.',
             user: { name: req.session.username, isLoggedIn: true } // Pass user info
        });
    }
    //doesnt change with display name changes
    /*comments.push({
        author: req.session.display_name,
        text,
        createdAt: new Date().toLocaleString()
    });
*/
    db.prepare(`
        INSERT INTO comments (user_id, text) VALUES (?, ?)
    `).run(req.session.userId,text);

    /*res.render('comments', {
        title: 'Comments',
        comments,
        user: { name: req.session.username, isLoggedIn: true },
        message: 'Comment added.'
    });*/
   res.redirect('/comments'); //////Do not want a page reload
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});

// Graceful shutdown, this will help the session to close the db gracefully since we're now using it.
process.on('SIGINT', () => {
  console.log('\nShutting down gracefully...');
  sessionStore.close();
  process.exit(0);
});