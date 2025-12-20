//=============================================
// Database Module
/* Sets up the wildwest SQLite3 database */
//=============================================

// Import SQLite database library
const Database = require('better-sqlite3');

// Import path utility
const path = require('path');

// Build absolute path to SQLite database file
const dbPath = path.join(__dirname, 'wildwest.db');

// Initialize and connect to SQLite database
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// ------------
// Users Table
// ------------
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    email TEXT UNIQUE,
    display_name TEXT,
    profile_customization TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME,
    lockout DATETIME,
    failed_attempts INTEGER DEFAULT 0
  );
`);

// ----------------
// Sessions Table
// ----------------
db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT UNIQUE NOT NULL,
    user_id INTEGER NOT NULL,
    sess TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expire DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

// ----------------
// Comments Table
// ----------------
db.exec(`
  CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    parent_id INTEGER,
    author_id INTEGER,
    text TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE CASCADE
  );
`);

// ----------------
// Login Attempts Table
// ----------------
// Tracking failed login attempts by IP and username
db.exec(`
  CREATE TABLE IF NOT EXISTS login_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ip_address TEXT NOT NULL,
    username TEXT NOT NULL,
    attempt_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    success INTEGER DEFAULT 0
  );
`);

// Create index for faster lookups on IP address and username combination
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_username 
  ON login_attempts(ip_address, username, attempt_time)
`);

// ----------------
// Socket Table
// ----------------
//Store chat messages for real-time socket communication

db.exec(`CREATE TABLE IF NOT EXISTS chat (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    display_name TEXT,
    message TEXT NOT NULL,
    timestamp TEXT DEFAULT CURRENT_TIMESTAMP
);
`)

// Create index for faster retrieval of chat messages (optimizes order)
db.exec(`
 CREATE INDEX IF NOT EXISTS idx_chat_timestamp ON chat(timestamp DESC);
`);

// Debug console messages disabled for production:
/*console.log('Using SQLite DB at:', dbPath);

// List tables
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('Tables:', tables);*/

//-----------------
// Export Modules
//-----------------
module.exports = db;
