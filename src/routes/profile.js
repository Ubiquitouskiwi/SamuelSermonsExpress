const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { requireLogin } = require('../middleware/auth');
const { getBadges, getNextBadge, getPointHistory, BADGES } = require('../utils/points');
const { getAchievements } = require('../utils/achievements');
const { AVATARS, getAvatar, getAvatarsForUser } = require('../utils/avatars');

/**
 * Resolve featured badges — validate they're still earned, replace lost ones.
 */
function resolveFeatured(featuredKeys, allEarned) {
  var earnedKeys = allEarned.map(function(a) { return a.key; });
  var resolved = [];
  var used = new Set();

  // Try to keep the user's chosen badges if still earned
  (featuredKeys || []).forEach(function(key) {
    if (earnedKeys.includes(key) && !used.has(key)) {
      resolved.push(allEarned.find(function(a) { return a.key === key; }));
      used.add(key);
    }
  });

  // Fill remaining slots with random earned badges
  if (resolved.length < 3) {
    var available = allEarned.filter(function(a) { return !used.has(a.key); });
    while (resolved.length < 3 && available.length > 0) {
      var idx = Math.floor(Math.random() * available.length);
      resolved.push(available[idx]);
      used.add(available[idx].key);
      available.splice(idx, 1);
    }
  }

  return resolved;
}

// My profile (private, full view)
router.get('/', requireLogin, async (req, res) => {
  try {
    const userResult = await pool.query(
      'SELECT id, display_name, nickname, bio, avatar, email, role, total_points, preferences, created_at FROM users WHERE id = $1',
      [req.session.userId]
    );
    const user = userResult.rows[0];
    user.avatarData = getAvatar(user.avatar);
    const badges = getBadges(user.total_points);
    const nextBadge = getNextBadge(user.total_points);
    const history = await getPointHistory(req.session.userId, 30);
    const statsResult = await pool.query(
      `SELECT COUNT(*) FILTER (WHERE reason='transcription_complete') AS transcriptions_done,
              COUNT(*) FILTER (WHERE reason='sermon_uploaded') AS sermons_uploaded,
              SUM(points) AS total_earned
       FROM user_points WHERE user_id = $1`, [req.session.userId]
    );
    const achievements = await getAchievements(req.session.userId);
    const allEarned = [...badges.map(b => ({ ...b, key: b.key })), ...achievements.filter(a => a.earned)];
    const featuredKeys = (user.preferences && user.preferences.featured_badges) || [];
    const featured = resolveFeatured(featuredKeys, allEarned);
    const userRoles = user.role ? user.role.split(',').map(r => r.trim()) : [];
    const availableAvatars = getAvatarsForUser(userRoles, badges, achievements, user.email);

    res.render('profile', {
      profileUser: user, badges, nextBadge, allBadges: BADGES,
      history, stats: statsResult.rows[0], achievements,
      avatars: availableAvatars, featured, allEarned, pageTitle: 'My Profile'
    });
  } catch (err) {
    console.error('Profile error:', err);
    res.redirect('/admin');
  }
});

// Save featured badges
router.post('/featured', requireLogin, async (req, res) => {
  let badges = req.body.featured || [];
  if (typeof badges === 'string') badges = [badges];
  badges = badges.slice(0, 3); // Max 3
  try {
    const current = await pool.query('SELECT preferences FROM users WHERE id=$1', [req.session.userId]);
    const prefs = current.rows[0]?.preferences || {};
    prefs.featured_badges = badges;
    await pool.query('UPDATE users SET preferences=$1, updated_at=NOW() WHERE id=$2', [JSON.stringify(prefs), req.session.userId]);
  } catch (err) {
    console.error('Save featured error:', err);
  }
  res.redirect('/profile');
});

// Edit profile
router.post('/edit', requireLogin, async (req, res) => {
  const { nickname, bio, avatar } = req.body;
  try {
    const validAvatar = AVATARS.find(a => a.key === avatar) ? avatar : 'book';
    await pool.query(
      'UPDATE users SET nickname=$1, bio=$2, avatar=$3, updated_at=NOW() WHERE id=$4',
      [(nickname || '').trim().substring(0, 50), (bio || '').trim().substring(0, 500), validAvatar, req.session.userId]
    );
  } catch (err) {
    console.error('Profile edit error:', err);
  }
  res.redirect('/profile');
});

// Public profile (viewable by anyone)
router.get('/:id', async (req, res) => {
  const userId = parseInt(req.params.id, 10);
  if (isNaN(userId)) return res.redirect('/');
  try {
    const userResult = await pool.query(
      'SELECT id, display_name, nickname, bio, avatar, role, total_points, preferences, created_at FROM users WHERE id=$1 AND is_active=true',
      [userId]
    );
    if (userResult.rows.length === 0) return res.status(404).render('404', { pageTitle: 'User Not Found' });
    const user = userResult.rows[0];
    user.avatarData = getAvatar(user.avatar);
    const badges = getBadges(user.total_points);
    const statsResult = await pool.query(
      `SELECT COUNT(*) FILTER (WHERE reason='transcription_complete') AS transcriptions_done,
              COUNT(*) FILTER (WHERE reason='sermon_uploaded') AS sermons_uploaded,
              COUNT(*) FILTER (WHERE reason='review_complete') AS reviews_done
       FROM user_points WHERE user_id = $1`, [userId]
    );
    const achievements = await getAchievements(userId);
    const earned = achievements.filter(a => a.earned);
    const allEarned = [...badges.map(b => ({ ...b, key: b.key })), ...earned];
    const featuredKeys = (user.preferences && user.preferences.featured_badges) || [];
    const featured = resolveFeatured(featuredKeys, allEarned);

    res.render('profile-public', { profileUser: user, badges, stats: statsResult.rows[0], earned, featured, pageTitle: user.nickname || user.display_name });
  } catch (err) {
    console.error('Public profile error:', err);
    res.redirect('/');
  }
});

module.exports = router;
