//=============================================
// Socket-IO Module
/* Handles chat message storage and real-time chat */
//=============================================

// Requires user authentication for all endpoint

// -- console.log('chat.js loaded');

const express = require('express');
const router = express.Router();
const db = require('../modules/database');

//---------------------------
// Middleware: Require Login
// --------------------------

// Ensures user is logged in before accessing chat endpoints
function requireLogin(req, res, next) {
    if (!req.session?.isLoggedIn) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    next();
}

//---------------
// GET /api/chat
//---------------
//Retrieve chat history

// Fetches latest 100 chat messages from the database (oldest first)
router.get('/', requireLogin, (req, res) => {
    try {
        const messages = db.prepare(`
            SELECT display_name, message, timestamp
            FROM chat
            ORDER BY timestamp DESC
            LIMIT 100
        `).all().reverse(); // oldest first
        res.json(messages);
    } catch (err) {
        console.error('Error fetching chat messages:', err);
        res.status(500).json({ error: 'Failed to fetch chat messages' });
    }
});

//----------------
// POST /api/chat
//----------------
// Validates input, stores message in database, and broadcasts via Socket.IO

router.post('/', requireLogin, (req, res) => {
    try {
        const message = req.body.message?.trim();

        // Input validation
        if (!message) return res.status(400).json({ error: 'Message cannot be empty' });
        if (message.length > 500) return res.status(400).json({ error: 'Message too long (max 500 chars)' });

        const timestamp = new Date().toISOString();
        const displayName = req.session.display_name;

        // Save message in chat table
        db.prepare(`
            INSERT INTO chat (user_id, display_name, message, timestamp)
            VALUES (?, ?, ?, ?)
        `).run(req.session.userId, displayName, message, timestamp);

        const chatMessage = { display_name: displayName, message, timestamp };

        // Broadcast to all connected clients via Socket.IO
        req.app.get('io').emit('message', chatMessage);

        res.json({ success: true, message: chatMessage });
    } catch (err) {
        console.error('Error sending chat message:', err);
        res.status(500).json({ error: 'Failed to send message' });
    }
});

//-----------------
// Export Modules
//-----------------
module.exports = router;
