// -- Routes/ auth Module -- 
const express = require('express');
const router = express.Router();
const db = require('../modules/database');
const { validatePassword, hashPassword, comparePassword } = require('../modules/password-utils');
const loginTracker = require('../modules/login-tracker');
const { checkLoginLockout, getClientIP } = require('../modules/auth-middleware');


/* RES RENDER when --> page loads normally, success pages, GET routes
RES STATUS when error
page routes hbs --> res redirect
apiroutes  json*/
// --------------
// --Register --
// --------------

// GET /register - Show registration form
router.get('/register', (req, res) => {
  res.render('register');
});

// POST /register - Register a new user
router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Validate input
    if (!username || !password) {
      return res.status(400).render('register', { 
        error: 'Username and password are required' 
      });
    }
    
    // Validate password requirements
    const validation = validatePassword(password);
    if (!validation.valid) {
      return res.status(400).render('register', {
        error: 'Password does not meet requirements',
        errors: validation.errors
      });
    }
    
    // Check if username already exists
    const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existingUser) {
      return res.status(409).render('register', { 
        error: 'Username already exists' 
      });
    }
    
    // Hash the password before storing
    const passwordHash = await hashPassword(password);
    
    // Insert new user into database
    const new_insert = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)');
    const result = new_insert.run(username, passwordHash);
    
    res.redirect('/login?message=registered');
    
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).render('register', { error: 'Internal server error. Please try again later.' });
  }
});
// --------------
// --Login--
// --------------

// GET /login - Show login form
router.get('/login', (req, res) => {
  const { message } = req.query;
  res.render('login', { message });
});
// POST /login - Authenticate user- Now includes lockout checking and attempt tracking
router.post('/login', checkLoginLockout, async (req, res) => {
  try {
    const { username, password } = req.body;
    const ipAddress = getClientIP(req);
    
    // Validate input
    if (!username || !password) {
      // Record failed attempt if username is provided
      if (username) {
        loginTracker.recordAttempt(ipAddress, username, false);
      }
      return res.status(400).render('login', { 
        error: 'Username and password are required' 
      });
    }
    
    // Find user by username
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    
    if (!user) {
      // Record failed attempt (user doesn't exist)
      // Don't reveal if username exists (security best practice)
      loginTracker.recordAttempt(ipAddress, username, false);
      return res.status(401).render('login', { 
        error: 'Invalid username or password' 
      });
    }
    
    // Compare entered password with stored hash
    const passwordMatch = await comparePassword(password, user.password_hash);
    
    if (!passwordMatch) {
      // Record failed attempt (wrong password)
      loginTracker.recordAttempt(ipAddress, username, false);
      return res.status(401).render('login', { 
        error: 'Invalid username or password' 
      });
    }
    
    // Successful login
    loginTracker.recordAttempt(ipAddress, username, true);
    
    // Successful login - Update last login time
    db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?')
      .run(user.id);
    
    // Create session
    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.isLoggedIn = true;

    // Homepage
    return res.redirect('/');
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).render('login', { 
      error: 'Internal server error' 
    });
  }
});

/**
 * GET /logout - Logout user (GET version for easy link access)
 */
router.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).render('error', {
        error: 'An error occurred while logging out.'
      });
    }
    res.redirect('/');
  });
});

// -- Logout --
// POST /logout - Logout user
//uses json bc its js calls 
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).json({ error: 'Error logging out' });
    }
    res.json({ message: 'Logged out successfully' });
  });
});

/*
 GET /me - Get current user info (requires authentication)
 uses json bc api endpoint
 */
router.get('/me', (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  const user = db.prepare('SELECT id, username, created_at, last_login FROM users WHERE id = ?')
    .get(req.session.userId);
  
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Pass user data as query parameters to the profile page
  const params = new URLSearchParams({
    id: user.id,
    username: user.username,
    created_at: user.created_at || 'N/A',
    last_login: user.last_login || 'Never'
  });
  
  res.json({ user });
});

module.exports = router;


