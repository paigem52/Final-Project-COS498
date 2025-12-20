console.log('chat.js loaded');

const express = require('express');
const router = express.Router();
const db = require('../modules/database'); // your db module

// Middleware to require login
function requireLogin(req, res, next) {
    if (!req.session?.isLoggedIn) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    next();
}

// Get chat history (GET /api/chat)
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

// Send a new chat message (POST /api/chat)
router.post('/', requireLogin, (req, res) => {
    try {
        const message = req.body.message?.trim();
        if (!message) return res.status(400).json({ error: 'Message cannot be empty' });
        if (message.length > 500) return res.status(400).json({ error: 'Message too long (max 500 chars)' });

        const timestamp = new Date().toISOString();
        const displayName = req.session.display_name;

        // Save message in DB
        db.prepare(`
            INSERT INTO chat (user_id, display_name, message, timestamp)
            VALUES (?, ?, ?, ?)
        `).run(req.session.userId, displayName, message, timestamp);

        const chatMessage = { display_name: displayName, message, timestamp };

        // Broadcast via Socket.IO
        req.app.get('io').emit('message', chatMessage);

        res.json({ success: true, message: chatMessage });
    } catch (err) {
        console.error('Error sending chat message:', err);
        res.status(500).json({ error: 'Failed to send message' });
    }
});

module.exports = router;
