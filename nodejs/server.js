//=============================================
// Server.js Module
/* Main entry point for the Node.js and Express application
// Sets up server, routing, sessions, Handlebars views, and Socket.IO chat */
//=============================================

//-----------------
//Required Modules
//-----------------
const express = require('express');
const hbs = require('hbs');
const path = require('path');
const app = express();
const session = require('express-session');  //No longer need cookie-parser
const SQLiteStore = require('./modules/session-store');
const authRoutes = require('./routes/auth');
const { requireAuth } = require('./modules/auth-middleware');
const db = require('./modules/database');

// Socket.io setup
const http = require('http');
const { Server } = require('socket.io');

// Create HTTP server from Express app
const server = http.createServer(app);

// Initialize Socket.IO on top of HTTP server with CORS enabled
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Attach Socket.IO instance to Express app for access in routes
app.set('io', io);

// Server port configuration
const PORT = process.env.PORT || 3498;

//------------------
// Handlebars Setup
//------------------
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

//Helpers:
// -- Check Equality
hbs.registerHelper('eq', function(a, b) {
  return a === b;
});
// -- Pagination
hbs.registerHelper('add', (a, b) => a + b);
hbs.registerHelper('subtract', (a, b) => a - b);
hbs.registerHelper('gt', (a, b) => a > b);
hbs.registerHelper('lt', (a, b) => a < b);

//Register partials directory
hbs.registerPartials(path.join(__dirname, 'views', 'partials'));

//-------------
//Middleware
//-------------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Needed (Nginx proxy)
app.set('trust proxy',1);

// Serve static files from the 'public' directory
app.use(express.static('public'));

// Session configuration with SQLite store
const sessionStore = new SQLiteStore({
  db: path.join(__dirname, 'sessions.db'),
  table: 'sessions'
});

const sessionMiddleware = session({
  store: sessionStore,
  secret: process.env.SESSION_SECRET || 'change-this-secret-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: true, // Cookie sent over HTTPS
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
});

// Apply session middleware:
// -- to Express
app.use(sessionMiddleware);
// -- to Socket.IO engine for shared sessions
io.engine.use(sessionMiddleware);

// Make login info available in templates
app.use((req, res, next) => {
    res.locals.isLoggedIn = req.session.isLoggedIn || false;
    res.locals.username = req.session.username || null;
    res.locals.display_name = req.session.display_name || null;
    next();
});

//--------
// Routes
//--------
app.use('/api/auth', authRoutes);
app.use('/api/chat', require('./routes/chat')); // chat API for history

//Health/Test Routes
// Used for monitoring or verifying the server is running

app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy',
        service: 'nodejs-backend'
    });
});

app.get('/test', (req, res) => {
  res.render('home', {
    title: 'Handlebars Test',
    message: 'If you see this, Handlebars is working properly.'
  });
});

//--------------------------
// Socket.IO Real-Time Chat
//--------------------------
io.on('connection', (socket) => {
    const session = socket.request.session;

    // Disconnect unauthenticated users
    if (!session?.isLoggedIn) {
        socket.emit('error', { message: 'Authentication required' });
        socket.disconnect();
        return;
    }

    console.log(`User ${session.display_name} connected to chat.`);

    // Send last 50 messages to user
    const recentMessages = db.prepare(`
        SELECT display_name, message, timestamp
        FROM chat
        ORDER BY timestamp DESC
        LIMIT 50
    `).all().reverse(); // Send oldest first
    socket.emit('chatHistory', recentMessages);

    // Handle incoming messages from client
    socket.on('sendMessage', (data) => {
        console.log('Received message:', data);
        const msg = data.message?.trim();
        if (!msg) return;

        const timestamp = new Date().toISOString();
        const displayName = session.display_name;
        const userId = session.userId;

        // Save message to database
        db.prepare(`
            INSERT INTO chat (user_id, display_name, message, timestamp)
            VALUES (?, ?, ?, ?)
        `).run(userId, displayName, msg, timestamp);

        // Broadcast message to all connected clients
        io.emit('message', { display_name: displayName, message: msg, timestamp });
    });

    // Log disconnections
    socket.on('disconnect', () => {
        console.log(`User ${session.display_name} disconnected.`);
    });
});

//--------------
//GET Routes
//--------------

//----------
// Homepage
app.get('/', (req, res) => {
   
    // Default guest user object
     let user = { 
        name: "Guest",
        isLoggedIn: false,
        loginTime: null,
        visitCount: 0
    }; 

    // If logged in, populate session info
    if (req.session.isLoggedIn) {
        // -- console.log('succesfully pulled session');

        // Format login time
        const loginTimeISO =req.session.loginTime || new Date().toISOString();
        const loginTimeFormatted = new Date(loginTimeISO).toLocaleString('en-US', { 
                timeZone: 'America/New_York',
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit', second: '2-digit',
                hour12: true 
            });

        user = {
            name: req.session.username,
            display_name: req.session.display_name,
            isLoggedIn: true,
            loginTime: loginTimeFormatted,
            visitCount: req.session.visitCount
        };
        
        // Increment visit count per session
        req.session.visitCount = (req.session.visitCount || 0) + 1;
    }
   
    // Render home page with specific user
    res.render('home', {
        title: 'Welcome to Less Wild West Forum', 
        user: user
    });
});

//------------------
//Registration Page
app.get('/register', (req, res) => {
    res.render('register', { title: 'Register' });
});

//------------
// Login Page
app.get('/login', (req, res) => {

    // Error and Success Messages
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

//---------------
// Comments Page
// -- Pagination    -- Replies

app.get('/comments', (req, res) => {
    // Default guest user
    let user = {
        name: "Guest",
        isLoggedIn: false
    };

    // Session info for logged in users
    if (req.session.isLoggedIn) {
        user = {
            name: req.session.username,
            isLoggedIn: true
        };
    }

    // Pagination setup
    const page = parseInt(req.query.page) || 1;
    const limit = 20; //Per project requirements
    const offset = (page-1) * limit;

    // Fetch top-level comments
    const topComments = db.prepare(`
        SELECT comments.id, comments.text, comments.created_at AS createdAt, users.display_name AS author_display_name
        FROM comments
        JOIN users ON comments.user_id = users.id
        WHERE comments.parent_id IS NULL
        ORDER BY comments.created_at DESC
        LIMIT ? OFFSET ?;
    `).all(limit, offset);

    // Fetch replies for these top-level comments
    const topIds = topComments.map(comments => comments.id);
    let replies = [];
    if (topIds.length > 0) {
        replies = db.prepare(`
            SELECT comments.id, comments.text, comments.parent_id, comments.created_at AS createdAt, users.display_name AS author_display_name
            FROM comments
            JOIN users ON comments.user_id = users.id
            WHERE comments.parent_id IN (${topIds.map(() => '?').join(',')})
            ORDER BY comments.created_at ASC
        `).all(...topIds);
    }

    // Map replies to their parent comments
    const commentsWithReplies = topComments.map(comments => {
        return {
            ...comments,
             // Convert timestamp for top-level comment
            createdAt: new Date(comments.createdAt).toLocaleString('en-US', { 
                timeZone: 'America/New_York', 
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit', second: '2-digit',
                hour12: true 
            }),
            
            replies: replies.filter(r => r.parent_id === comments.id).map(r => ({
            ...r,
                // Format timestamp
                createdAt: new Date(r.createdAt).toLocaleString('en-US', { 
                    timeZone: 'America/New_York', 
                    year: 'numeric', month: '2-digit', day: '2-digit',
                    hour: '2-digit', minute: '2-digit', second: '2-digit',
                    hour12: true 
                })
            }))
        };
    });

    // Total counts for pagination
    const totalTopComments = db.prepare(`
        SELECT COUNT(*) AS count
        FROM comments
        WHERE parent_id IS NULL
    `).get();

    const totalPages = Math.ceil(totalTopComments.count / limit);

    // Total comments including replies
    const totalComments = db.prepare(`SELECT COUNT(*) AS count FROM comments;`).get();

    res.render('comments', { title: 'Comments', 
        comments: commentsWithReplies,
        user,
        currentPage: page,
        totalPages,
        totalComments: totalComments.count
    });
});

//------------------
// New Comment Page
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

//-----------------------------
// -- Example: Protected Route
app.get('/api/protected', requireAuth, (req, res) => {
  res.send(`Protected route that needs authentication. User: ${req.session.username} ID: ${req.session.userId}`);
});

//-----------
// Chat Page
app.get('/chat', (req, res) => {
    if (!req.session.isLoggedIn) return res.redirect('/login');
    res.render('chat', { 
        title: 'Live Chat', 
        user: { display_name: req.session.display_name } 
    });
});

//--------------
//POST Routes
//--------------

//---------
//Register
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

    // Check if user exists
    const existingUser = users.find(u => u.username === username);
    if (existingUser) {
       return res.render('register', {
            title: 'Register',
            error: 'Username already exists'
        });
    }

    // Create new user
    const newUser = {
        id: nextId++,
        username,
        password,
        display_name: req.body.display_name,
        email: req.body.email,
        createdAt: new Date().toISOString()
    };

    users.push(newUser);

    // Redirect to login page after registration
    res.redirect('/login?registered=1');

});

//------------
// Login Page
app.post('/login', (req, res) => {
    const username = req.body.username;
    const password = req.body.password;

    // Authenticate user
    const user = users.find( u => u.username === username && u.password === password);

    if (user) {
        // Set session data
        req.session.isLoggedIn = true;
        req.session.userId = user.id;
        req.session.username = user.username;
        req.session.loginTime = new Date().toISOString();
        req.session.visitCount = 0;
        req.session.display_name = user.display_name;
        req.session.email = user.email;
        
       // -- console.log(`User ${username} logged in at ${req.session.loginTime}`);
        res.redirect('/');
    } else {
        res.redirect('/login?error=1');
    }
});

//-------------
// Logout Page
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
    
//--------------
// Comment Page
app.post('/comments', (req, res) => {

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
  
    const { parent_id } = req.body; // Supports optional replies
    const parentId = parent_id ? parseInt(parent_id) : null; // Null if top-level


    db.prepare(`
        INSERT INTO comments (user_id, parent_id, text, created_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    `).run(req.session.userId, parentId, text);

   res.redirect('/comments'); //////Do not want a page reload
});


//--------------
// Start Server
//--------------

// Use server.listen() instead of app.listen() after Socket.IO integration
// (0.0.0.0 because docker and nginx use)
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://pdfinfoserver.org`);
});

// Graceful shutdown for session io
process.on('SIGINT', () => {
  console.log('\nShutting down gracefully...');
  sessionStore.close();
  process.exit(0);
});