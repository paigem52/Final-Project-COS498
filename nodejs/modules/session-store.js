// sqlite-session-store.js
/* This module was retrieved from Troy Schotter's webserver tomb
(Creating Your Own Node.js Modules/ Advanced Module Patterns),
with small changes and additional comments inserted for further explanation
per the projects requirements.*/

// Import the base Store class from express-session
const { Store } = require('express-session');
// Synchronous SQLite interface
const Database = require('better-sqlite3');
const path = require('path');

// SQLiteStore extends Store class
class SQLiteStore extends Store {
  // Constructor runs when the store is instantiated
  constructor(options = {}) {
    // Call the parent Store constructor
    super(options);

    // Use wildwest database to access sessions schema
    // Or else this will fall back to a local sessions.db file
    const dbPath = process.env.WILDWEST_DB_PATH ||  path.join(__dirname, 'wildwest.db');

    // Create the SQLite database
    this.db = new Database(dbPath);

    // Name of the sessions table
    this.table = 'sessions';


    // Create sessions table if it doesn't exist
    /* Stores:
      - session_id: unique identifier for the session
      - sess: text string of session data
      - expiration_date: timestamp for expiration
      - user_id: links session to a user*/
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ${this.table} (
        session_id TEXT PRIMARY KEY,
        sess TEXT NOT NULL,
        expiration_date INTEGER NOT NULL,
	      user_id INTEGER NOT NULL,
	      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
	      FOREIGN KEY(user_id) REFERENCES users(id)
      )
    `);

    // Periodically clean up expired sessions (runs every 15 minutes)
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 15 * 60 * 1000);
  }

  // Retrieve a session by session ID
  get(session_id, callback) {
    // Query for a non-expired session
    const row = this.db.prepare(
      `SELECT sess FROM ${this.table} WHERE session_id = ? AND expiration_date > ?`
    ).get(session_id, Date.now());

    // If a session exists, parse the JSON data
    if (row) {
      try {
        const session = JSON.parse(row.sess);
        callback(null, session);
      } catch (err) {
        // No more to parse
        callback(err);
      }
    } else {
      // No session found
      callback(null, null);
    }
  }

  // Save session
  set(session_id, sess, callback) {
    // Determine session expiration time
    // Uses cookie maxAge if available, otherwise defaults to 24 hours
    const maxAge = sess.cookie?.maxAge;
    const expire = maxAge ? Date.now() + maxAge : Date.now() + (24 * 60 * 60 * 1000);

    // Convert session object to JSON for storage
    const sessData = JSON.stringify(sess);

    try {
      // Insert new session or replace existing one
      this.db.prepare(
        `INSERT OR REPLACE INTO ${this.table} (session_id, sess, expire) VALUES (?, ?, ?)`
      ).run(session_id, sessData, expire);

      callback(null);
    } catch (err) {
      callback(err);
    }
  }

  // Destroy a session by ID
  destroy(session_id, callback) {
    try {
      this.db.prepare(`DELETE FROM ${this.table} WHERE session_id = ?`).run(session_id);
      callback(null);
    } catch (err) {
      callback(err);
    }
  }

  // Retrieve all active (non-expired) sessions
  all(callback) {
    try {
      const rows = this.db.prepare(
        `SELECT sess FROM ${this.table} WHERE expire > ?`
      ).all(Date.now());

      // Parse each session JSON string into an object
      const sessions = rows.map(row => JSON.parse(row.sess));
      callback(null, sessions);
    } catch (err) {
      callback(err);
    }
  }

  // Remove expired sessions from the database
  cleanup() {
    try {
      const result = this.db.prepare(
        `DELETE FROM ${this.table} WHERE expire <= ?`
      ).run(Date.now());

      // Log cleanup activitt if sessions were removed
      if (result.changes > 0) {
        console.log(`Cleaned up ${result.changes} expired session(s)`);
      }
    } catch (err) {
      console.error('Error cleaning up sessions:', err);
    }
  }

  // Close the database connection
  close() {
    // Stop the cleanup timer
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    // Close the SQLite database connection
    this.db.close();
  }
}

// Export the SQLiteStore class for use in express-session
module.exports = SQLiteStore;
