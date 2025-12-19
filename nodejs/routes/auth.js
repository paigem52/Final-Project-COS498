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
    const { username, password, email, display_name } = req.body;
    
    // Validate input
    if (!username || !password || !email || !display_name) {
      return res.status(400).render('register', { 
        error: 'Username, password, email and display name are required' 
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

    // Check if email format is validated
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).render('register', { 
        error: 'Invalid email format' 
      });
}
    // remove??? Check if display_name is unique/akready exists --should i make it unique in db?
    const existingDisplayName = db.prepare('SELECT id FROM users WHERE display_name = ?').get(display_name);
    if (existingDisplayName) {
      return res.status(409).render('register', { 
        error: 'Display name already taken' 
      });
}

    if (display_name===username) {
      return res.status(400).render('register', {
        error: 'Display name cannot be the same as username'
      });
    }

    // Check if email is unique
    const existingEmail = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
      if (existingEmail) {
        return res.status(409).render('register', { 
          error: 'Email already registered' 
        });
}

    
    // Hash the password before storing
    const passwordHash = await hashPassword(password);
    
    // Insert new user into database
    const new_insert = db.prepare('INSERT INTO users (username, password_hash, email, display_name) VALUES (?, ?, ?, ?)');
    const result = new_insert.run(username, passwordHash, email, display_name);
    console.log('Current users in DB:', db.prepare('SELECT * from users').all());
    
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
    console.log('Login Post');
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
    
    console.log('User fetched for login:', user);

    if (!user) {
      // Record failed attempt (user doesn't exist)
      // Don't reveal if username exists (security best practice)
      loginTracker.recordAttempt(ipAddress, username, false);
      return res.status(401).render('login', { 
        error: 'Invalid username or password' 
      });
    }
    
    // Compare entered password with stored hash
    console.log('Login attempt:', { username, password, hash: user.password_hash});
    const passwordMatch = await comparePassword(password, user.password_hash);
    console.log('Password match:', passwordMatch);
    
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
    req.session.display_name = user.display_name;
    req.session.email = user.email;


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

//PROFILE ROUTES
/*
 GET /me - Get current user info (requires authentication)
 uses json bc api endpoint
 */
// GET /profile - show user profile
router.get('/profile', (req, res) => {
  // Make sure user is logged in
  if (!req.session || !req.session.userId) {
    return res.redirect('/login'); // redirect to login instead of JSON
  }

  // Fetch user info from DB
  const user = db.prepare(`
    SELECT id, username, display_name, email, created_at, last_login, profile_customization
    FROM users
    WHERE id = ?
  `).get(req.session.userId);

  if (!user) {
    return res.status(404).render('profile', { error: 'User not found' });
  }

  //Parse prof customization json
  const customization = user.profile_customization ? JSON.parse(user.profile_customization) : {};
  
  // Render profile page with user info
  res.render('profile', {
    title: `${user.display_name || user.username}'s Profile`,
    user,
    customization,
    isLoggedIn: true    //fixes bug where login/register appear in account page
  });
});

// New GET /profile/customize
router.get('/profile/customize', (req, res) => {
  if (!req.session?.userId) return res.redirect('/login');

  const user = db.prepare('SELECT profile_customization FROM users WHERE id = ?')
                 .get(req.session.userId);

  const customization = user.profile_customization ? JSON.parse(user.profile_customization) : {};

  res.render('profile-customize', { user, customization });
});

// POST /profile/customize - Update user profile and customization
router.post('/profile/customize', (req, res) => {
  if (!req.session?.userId) return res.redirect('/login');

  try {
    let { display_name, email, display_name_color, avatar, bio } = req.body;

    if (email === '') {
      email = null;
    }

    if (display_name === '') {
      display_name = null;
    }

  //Validate email format only IF user typed on
  if (email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).render('profile-customize', { 
        user: req.session, 
        customization: req.body, 
        error: 'Invalid email format.' 
      });
    }
  }

    // Check for unique display name
    const existingDisplayName = db.prepare('SELECT id FROM users WHERE display_name = ? AND id != ?').get(display_name, req.session.userId);
    if (existingDisplayName) {
      return res.status(409).render('profile-customize', { 
        user: req.session, 
        customization: req.body, 
        error: 'Display name already taken.' 
      });
    }

    // Check for unique email
    const existingEmail = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email, req.session.userId);
    if (existingEmail) {
      return res.status(409).render('profile-customize', { 
        user: req.session, 
        customization: req.body, 
        error: 'Email already registered.' 
      });
    }

    // Prepare customization object
    const customization = { 
      display_name_color: display_name_color || '#0000', 
      avatar: avatar || '', 
      bio: bio || ''
    };

    const finalDisplayName = display_name ?? req.session.display_name;
    //Change email if entered, if not keep original
    const finalEmail = email ?? req.session.email;

    // Update database
    db.prepare(`
      UPDATE users
      SET display_name = ?, email = ?, profile_customization = ?
      WHERE id = ?
    `).run(finalDisplayName, finalEmail, JSON.stringify(customization), req.session.userId);

    // Update session info so page reflects changes immediately
    req.session.display_name = finalDisplayName;
    req.session.email = finalEmail;

    // Redirect back to profile page
    res.redirect('/api/auth/profile');

  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).render('profile', { 
      user: req.session, 
      customization: req.body, 
      error: 'Internal server error. Please try again later.' 
    });
  }
});




module.exports = router;


