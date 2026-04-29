const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { requireLogin } = require('../middleware/auth');
const { getBadges, getNextBadge, getPointHistory, BADGES, getAchievements } = require('../utils/points');

router.get('/', requireLogin, async (req, res) => {
  try {
    const userResult = await pool.query(
      'SELECT id, display_name, email, role, total_points, created_at FROM users WHERE id = $1',
      [req.session.userId]
    );
    const user = userResult.rows[0];
    const badges = getBadges(user.total_points);
    const nextBadge = getNextBadge(user.total_points);
    const history = await getPointHistory(req.session.userId, 30);

    // Stats
    const statsResult = await pool.query(
      `SELECT
        COUNT(*) FILTER (WHERE reason = 'transcription_complete') AS transcriptions_done,
        COUNT(*) FILTER (WHERE reason = 'sermon_uploaded') AS sermons_uploaded,
        SUM(points) AS total_earned
       FROM user_points WHERE user_id = $1`,
      [req.session.userId]
    );
    const stats = statsResult.rows[0];

    // Achievements
    const achievements = await getAchievements(req.session.userId);

    res.render('profile', { profileUser: user, badges, nextBadge, allBadges: BADGES, history, stats, achievements });
  } catch (err) {
    console.error('Profile error:', err);
    res.redirect('/admin');
  }
});

module.exports = router;
