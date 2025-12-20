//=============================================
// Login-Tracker Module
/* Tracks failed login attemps by username + IP, enforcing temporary lockouts
  to prevent brute-force authentication attacks*/
//=============================================

//Import shared SQLite database connection
const db = require('./database');

// --------------
// Configuration
// --------------

// Maximum number of failed login attempts allowed
const MAX_ATTEMPTS = 5;

// Duration of lockout period (15 minutes in milliseconds)
const LOCKOUT_DURATION = 15 * 60 * 1000;

//----------------------
// Record Login Attempt
//----------------------

// Stores each login attempt in the database
function recordAttempt(ipAddress, username, success) {
  const stmt = db.prepare(`
    INSERT INTO login_attempts (ip_address, username, success)
    VALUES (?, ?, ?)
  `);
  // `Success` is stored as 1 (true) or 0 (false)
  stmt.run(ipAddress, username, success ? 1 : 0);
}

//----------------------
// Check Lockout Status
//----------------------

// Checks if a username+IP combination is currently locked out
// (Based on recent failures)
function checkLockout(ipAddress, username) {
  const cutoffTime = Date.now() - LOCKOUT_DURATION;
  
  // Retrieve failed attempts within the lockout window
  // 'unixepoch' interprets the timestamp as seconds since Jan 1, 1970
  const stmt = db.prepare(`
    SELECT COUNT(*) as count, MAX(attempt_time) as last_attempt
    FROM login_attempts
    WHERE ip_address = ? 
      AND username = ?
      AND success = 0
      AND datetime(attempt_time) > datetime(?, 'unixepoch')
  `);
  // Date.now() is converted from milliseconds to seconds
  const result = stmt.get(ipAddress, username, cutoffTime / 1000);
  
  // If failed attempts exceed the allowed maximum
  if (result.count >= MAX_ATTEMPTS) {
    // Calculate remaining lockout time
    const lastAttempt = new Date(result.last_attempt).getTime();
    const lockoutEnds = lastAttempt + LOCKOUT_DURATION;
    const remainingTime = Math.max(0, lockoutEnds - Date.now());
    
    return {
      locked: true,
      remainingTime: remainingTime,
      attempts: result.count
    };
  }
  
  // No lockout
  return {
    locked: false,
    remainingTime: 0,
    attempts: result.count
  };
}

//----------------------
// Cleanup Old Attempts
//----------------------

// Removes login attempt records older than the lockout duration to keep table small
function cleanupOldAttempts() {
  const cutoffTime = Date.now() - LOCKOUT_DURATION;
  
  // 'unixepoch' interprets the number as seconds since Unix epoch (Jan 1, 1970)
  const stmt = db.prepare(`
    DELETE FROM login_attempts
    WHERE datetime(attempt_time) < datetime(?, 'unixepoch')
  `);
  
  // Converted to seconds
  const result = stmt.run(cutoffTime / 1000);
  return result.changes;
}

//----------
// Cleanup
//----------

// Automatically removes expired login attempts every hour
setInterval(() => {
  const deleted = cleanupOldAttempts();
  if (deleted > 0) {
    console.log(`Cleaned up ${deleted} old login attempt(s)`);
  }
}, 60 * 60 * 1000);

//-----------------
// Export Modules
//-----------------
module.exports = {
  recordAttempt,
  checkLockout,
  cleanupOldAttempts
};

