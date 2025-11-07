const express = require('express');
const hbs = require('hbs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

//In-memory storage
const users = [];
//const comments = [];

//Set up Handlebars
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

//Register partials directory
hbs.registerPartials(path.join(__dirname, 'views', 'partials'));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Nginx will handle static file serving --> app.use(express.static('public'));

// API Routes-- > don't include '/api' in routes because nginx strips it when forwarding
// nginx receives: http://localhost/api/users & forwards to: http://backend-nodejs:3000/users (without /api)

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

// Dummy data until POST requests and cookies
const comments = [
    { author: 'Steve', text: 'Howdy!', createdAt: new Date().toLocaleString() },
    { author: 'Bob', text: 'Yeehaw!', createdAt: new Date().toLocaleString() },
];

// GET Routes
//Homepage
app.get('/', (req, res) => {
    res.render('home', {
        title: 'Welcome to Wild West Forum'});
});

//Registration page
app.get('/register', (req, res) => {
    res.render('register', { title: 'Register' });
});

// Login page
app.get('/login', (req, res) => {
    res.render('login', { title: 'Login' });
});

// Comments page
app.get('/comments', (req, res) => {
    res.render('comments', { title: 'Comments', comments });
});

// New comment form
app.get('/comment/new', (req, res) => {
    // TEMPORARY UNTIL COOKIES
    res.render('new-comment', { title: 'New Comment', message: 'Login required to post comments.' });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
