/**
 * Admin routes — thin router that mounts feature sub-routers.
 */
const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { requireLogin } = require('../middleware/auth');

// All admin routes require login
router.use(requireLogin);

// Dashboard
router.get('/', async (req, res) => {
  let stats = { sermons: 0, users: 0, transcribed: 0 };
  try {
    const sermonCount = await pool.query('SELECT COUNT(*) FROM sermons');
    const userCount = await pool.query('SELECT COUNT(*) FROM users WHERE is_active = true');
    const transcribedCount = await pool.query("SELECT COUNT(*) FROM sermons WHERE transcription_status = 'complete'");
    stats.sermons = parseInt(sermonCount.rows[0].count, 10);
    stats.users = parseInt(userCount.rows[0].count, 10);
    stats.transcribed = parseInt(transcribedCount.rows[0].count, 10);
  } catch (err) {
    console.error('Dashboard stats error:', err.message);
  }
  res.render('admin/dashboard', { stats });
});

// Mount sub-routers
router.use('/users', require('./admin/users'));
router.use('/requests', require('./admin/requests'));
router.use('/sermons', require('./admin/sermons'));
router.use('/transcribe', require('./admin/transcribe'));
router.use('/reviews', require('./admin/reviews'));
router.use('/blocklist', require('./admin/blocklist'));
router.use('/', require('./admin/misc'));

module.exports = router;
