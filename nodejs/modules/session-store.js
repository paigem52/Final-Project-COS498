//=============================================
// SQLite-Session-Store Module
/* Custom SQLite-backend session store for express-session*/
//=============================================

//-------------
// Dependencies
//-------------

// Import Base Store class required by express-session
const { Store } = require('express-session');

// Synchronous SQLite interface
const Database = require('better-sqlite3');

// Path utility
const path = require('path');

//-------------------
// SQLiteStore Class
//-------------------

// Extends express-session's Store class to persist session data in SQLite database
class SQLiteStore extends Store {

  // Constructor runs when the store is instantiated
  constructor(options = {}) {

    // Call the parent Store constructor
    super(options);

    // Determine database path:
    //      - Uses shared wildwest database if provided
    //      - Otherwise falls back to a local SQLite file
    const dbPath = process.env.WILDWEST_DB_PATH ||  path.join(__dirname, 'wildwest.db');

    // Initialize SQLite database connection
    this.db = new Database(dbPath);

    // Name of the sessions table
    this.table = 'sessions';

    // Create sessions table if it doesn't exist
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ${this.table} (
        session_id TEXT PRIMARY KEY,
        sess TEXT NOT NULL,
        expire INTEGER NOT NULL,
	      user_id INTEGER NOT NULL,
	      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
	      FOREIGN KEY(user_id) REFERENCES users(id)
      )
    `);

    // Periodically remove expired sessions (every 15 minutes)
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 15 * 60 * 1000);
  }

  //------------------
  // Retrieve Session
  //------------------

  // Fetches a non-expired session by session ID
  get(session_id, callback) {
    const row = this.db.prepare(
      `SELECT sess FROM ${this.table} WHERE session_id = ? AND expire > ?`
    ).get(session_id, Date.now());

    if (row) {
      try {
        // Parse stored JSON session data
        const session = JSON.parse(row.sess);
        callback(null, session);
      } catch (err) {
        callback(err);
      }
    } else {
      // No active session found
      callback(null, null);
    }
  }
  //--------------
  // Save Session
  //--------------

  // Inserts or updates a session record
  set(session_id, sess, callback) {

    // Determine session expiration time:
    //    - Uses cookie maxAge if available
    const maxAge = sess.cookie?.maxAge;
    //    - Otherwise defaults to 24 hours
    const expire = maxAge ? Date.now() + maxAge : Date.now() + (24 * 60 * 60 * 1000);

    // Serialize session object for storage
    const sessData = JSON.stringify(sess);

    try {
      // Insert new session or replace existing one
      this.db.prepare(
        `INSERT OR REPLACE INTO ${this.table} (session_id, sess, expire, user_id) VALUES (?, ?, ?, ?)`
      ).run(session_id, sessData, expire, sess.userId);

      callback(null);
    } catch (err) {
      callback(err);
    }
  }

  //-----------------
  // Destroy Session
  //-----------------

  // Deletes a session by session ID
  destroy(session_id, callback) {
    try {
      this.db.prepare(`DELETE FROM ${this.table} WHERE session_id = ?`).run(session_id);
      callback(null);
    } catch (err) {
      callback(err);
    }
  }

  //-----------------------
  // Retrieve All Sessions
  //-----------------------

  // Returns all active (non-expired) sessions
  all(callback) {
    try {
      const rows = this.db.prepare(
        `SELECT sess FROM ${this.table} WHERE expire > ?`
      ).all(Date.now());

      // Deserialize each session
      const sessions = rows.map(row => JSON.parse(row.sess));
      callback(null, sessions);
    } catch (err) {
      callback(err);
    }
  }

  //-------------------------
  // Cleanup Expired Sessions
  //-------------------------

  // Remove expired sessions from database
  cleanup() {
    try {
      const result = this.db.prepare(
        `DELETE FROM ${this.table} WHERE expire <= ?`
      ).run(Date.now());

      // Log cleanup activity if any sessions were removed
      if (result.changes > 0) {
        console.log(`Cleaned up ${result.changes} expired session(s)`);
      }
    } catch (err) {
      console.error('Error cleaning up sessions:', err);
    }
  }

  //-------------
  // Close Store
  //-------------

  // Stops cleanup timer and closes database connection
  close() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.db.close();
  }
}

//-----------------
// Export Modules
//-----------------

// Export the SQLiteStore class for use in express-session
module.exports = SQLiteStore;
