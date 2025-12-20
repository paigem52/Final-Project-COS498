//=============================================
// Auth-Middleware Module
/* Handles authentication checks and login lockout protection for Express routes*/
//=============================================

// Dependency: tracks failed login attempts per username + IP
const loginTracker = require('./login-tracker');

//------------------------------------
// Middleware: Require Authentication
//------------------------------------

// Checks for a valid session containing user id 
// (Make sure user is logged in before accessing protected routes)
function requireAuth(req, res, next) {
  if (req.session && req.session.userId) {
    next();
  } else {
    // User is not authenticated
    res.status(401).json({ error: 'Authentication required' });
  }
}

//------------------------------------
// Middleware: Login Lockout Check
//------------------------------------

// Prevents brute-force login attempts 
// (Enforces a username + IP-based lockout policy)
// NOTES: - Should be used before login route handlers
//        - Requires the username to be in req.body.username
function checkLoginLockout(req, res, next) {
  const ipAddress = getClientIP(req);
  const username = req.body?.username;
  
  // If no username provided, skip lockout check 
  // Handled by input validation
  if (!username) {
    return next();
  }
  
  // Check lockout status using loginTracker
    const lockoutStatus = loginTracker.checkLockout(ipAddress, username);
    if (lockoutStatus.locked) {
      //Convert remaining lockout time to minutes
      const minutesRemaining = Math.ceil(lockoutStatus.remainingTime / (60 * 1000));
      // Render login page with error instead of returning JSON
      // (Used for server-side HBS rendering)
      return res.status(429).render('login', { 
        error: `Too many failed login attempts. Try again in ${minutesRemaining} minute(s).` ,
        minutesRemaining
      });
    }
  
  // No lockout detected, continue to login handler
  next();
}

//------------------------------------
// Helper: Get Client IP Address
//------------------------------------

// Retrieves client's IP address while accounting for:
// - Reverse proxies  -Load balances  -Direct connections
function getClientIP(req) {
  return req.ip || 
         req.headers['x-forwarded-for']?.split(',')[0] || 
         req.connection.remoteAddress || 
         'unknown';
}

//-----------------
// Export Modules
//-----------------
module.exports = {
  requireAuth,
  checkLoginLockout,
  getClientIP
};


