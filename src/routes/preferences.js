const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { requireLogin } = require('../middleware/auth');

// Get current user's preferences
router.get('/', requireLogin, async (req, res) => {
  try {
    const result = await pool.query('SELECT preferences FROM users WHERE id = $1', [req.session.userId]);
    res.json(result.rows[0]?.preferences || {});
  } catch (err) {
    console.error('Preferences load error:', err);
    res.status(500).json({});
  }
});

// Update preferences (merges with existing)
router.post('/', requireLogin, express.json(), async (req, res) => {
  try {
    // Merge incoming prefs with existing ones
    const current = await pool.query('SELECT preferences FROM users WHERE id = $1', [req.session.userId]);
    const existing = current.rows[0]?.preferences || {};
    const merged = Object.assign({}, existing, req.body);

    await pool.query('UPDATE users SET preferences = $1, updated_at = NOW() WHERE id = $2', [JSON.stringify(merged), req.session.userId]);
    res.json({ ok: true, preferences: merged });
  } catch (err) {
    console.error('Preferences save error:', err);
    res.status(500).json({ ok: false });
  }
});

module.exports = router;
