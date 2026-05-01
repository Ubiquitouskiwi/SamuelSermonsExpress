const express = require('express');
const router = express.Router();
const pool = require('../../db/pool');
const { requireRole } = require('../../middleware/auth');

// ==========================================================================
// Leaderboard (all authenticated users)
// ==========================================================================
router.get('/leaderboard', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.display_name, u.nickname, u.avatar, u.role, u.total_points, u.created_at,
              (SELECT COUNT(*) FROM user_points WHERE user_id=u.id AND reason='transcription_complete') AS transcriptions,
              (SELECT COUNT(*) FROM user_points WHERE user_id=u.id AND reason='sermon_uploaded') AS uploads,
              (SELECT COUNT(*) FROM user_points WHERE user_id=u.id AND reason='review_complete') AS reviews,
              (SELECT COALESCE(SUM(LENGTH(s.transcription_text)-LENGTH(REPLACE(s.transcription_text,' ',''))+1),0) FROM sermons s WHERE s.transcribed_by=u.id AND s.transcription_text IS NOT NULL) AS word_count
       FROM users u
       WHERE u.is_active = true AND u.total_points > 0
       ORDER BY u.total_points DESC`
    );
    const { getAvatar } = require('../utils/avatars');
    result.rows.forEach(function(u) { u.avatarEmoji = getAvatar(u.avatar).emoji; });
    res.render('admin/leaderboard', { users: result.rows, pageTitle: 'Leaderboard' });
  } catch (err) {
    console.error('Leaderboard error:', err);
    res.render('admin/leaderboard', { users: [], pageTitle: 'Leaderboard' });
  }
});

// ==========================================================================
// Birthday Messages (admin only)
// ==========================================================================
router.get('/birthday-messages', requireRole('admin'), async (req, res) => {
  const year = req.query.year || new Date().getFullYear();
  try {
    const result = await pool.query(
      'SELECT * FROM birthday_messages ORDER BY created_at DESC'
    );
    // Group by year
    const byYear = {};
    result.rows.forEach(function(m) {
      if (!byYear[m.year]) byYear[m.year] = [];
      byYear[m.year].push(m);
    });
    const years = Object.keys(byYear).sort().reverse();
    res.render('admin/birthday-messages', { byYear, years, pageTitle: 'Birthday Messages' });
  } catch (err) {
    console.error('Birthday messages error:', err);
    res.render('admin/birthday-messages', { byYear: {}, years: [], pageTitle: 'Birthday Messages' });
  }
});

// ==========================================================================
// Admin Activity Log (admin + developer)
// ==========================================================================
router.get('/activity', requireRole('admin', 'developer'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT e.id, e.event_type, e.title, e.description, e.created_at,
              s.title AS sermon_title, s.id AS sermon_id,
              u.display_name AS user_name
       FROM sermon_events e
       LEFT JOIN sermons s ON e.sermon_id = s.id
       LEFT JOIN users u ON e.created_by = u.id
       ORDER BY e.created_at DESC
       LIMIT 100`
    );
    res.render('admin/activity', { events: result.rows, pageTitle: 'Activity Log' });
  } catch (err) {
    console.error('Activity log error:', err);
    res.render('admin/activity', { events: [], pageTitle: 'Activity Log' });
  }
});


// ==========================================================================
// PDF Proxy for OCR (avoids CORS issues with Spaces CDN)
// ==========================================================================
router.get('/proxy-pdf/:id', requireRole('admin', 'transcriber'), async (req, res) => {
  try {
    const result = await pool.query('SELECT pdf_path FROM sermons WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).send('Not found');
    const pdfUrl = result.rows[0].pdf_path;

    // Fetch the PDF server-side and pipe it to the client
    const fetch = (await import('node:https')).default || require('https');
    const https = require('https');
    https.get(pdfUrl, function (pdfRes) {
      res.set('Content-Type', 'application/pdf');
      res.set('Cache-Control', 'private, max-age=3600');
      pdfRes.pipe(res);
    }).on('error', function (err) {
      console.error('PDF proxy error:', err);
      res.status(502).send('Failed to fetch PDF');
    });
  } catch (err) {
    console.error('PDF proxy error:', err);
    res.status(500).send('Server error');
  }
});


module.exports = router;
