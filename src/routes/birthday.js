const express = require('express');
const router = express.Router();
const pool = require('../db/pool');

// Save a birthday message
router.post('/message', express.json(), async (req, res) => {
  const { author_name, message } = req.body;
  if (!message || message.trim().length < 1 || message.length > 2000) {
    return res.status(400).json({ ok: false, error: 'Message is required (max 2000 chars).' });
  }
  try {
    const year = new Date().getFullYear();
    await pool.query(
      'INSERT INTO birthday_messages (author_name, message, year) VALUES ($1, $2, $3)',
      [(author_name || '').trim().substring(0, 100) || 'Anonymous', message.trim(), year]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('Birthday message error:', err);
    res.status(500).json({ ok: false });
  }
});

// Get messages for a year (admin view)
router.get('/messages', async (req, res) => {
  const year = req.query.year || new Date().getFullYear();
  try {
    const result = await pool.query(
      'SELECT author_name, message, created_at FROM birthday_messages WHERE year = $1 ORDER BY created_at DESC',
      [year]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json([]);
  }
});

module.exports = router;
