const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { requireLogin, requireRole } = require('../middleware/auth');
const upload = require('../middleware/upload');
const spaces = require('../utils/spaces');
const { logEvent } = require('../utils/events');
const { awardUpload, awardStageMove, awardTranscriptionStarted, awardTranscriptionComplete } = require('../utils/points');

// All admin routes require login
router.use(requireLogin);

// --- Dashboard home ---
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

// --- User Management (admin only) ---
router.get('/users', requireRole('admin'), async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, display_name, role, is_active, must_change_password, last_login_at, created_at FROM users ORDER BY created_at DESC'
    );
    const requests = await pool.query(
      "SELECT * FROM access_requests WHERE status = 'pending' ORDER BY created_at DESC"
    );
    res.render('admin/users', { users: result.rows, requests: requests.rows });
  } catch (err) {
    console.error('User list error:', err);
    res.render('admin/users', { users: [], requests: [] });
  }
});

// Edit user
router.get('/users/:id/edit', requireRole('admin'), async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, display_name, role, is_active, must_change_password FROM users WHERE id = $1',
      [req.params.id]
    );
    if (result.rows.length === 0) return res.redirect('/admin/users');
    res.render('admin/user-edit', { editUser: result.rows[0], error: null, success: null });
  } catch (err) {
    console.error('User edit error:', err);
    res.redirect('/admin/users');
  }
});

router.post('/users/:id/edit', requireRole('admin'), async (req, res) => {
  const userId = parseInt(req.params.id, 10);
  const { display_name, is_active, must_change_password } = req.body;
  // Collect roles from checkboxes
  let roles = req.body.roles || [];
  if (typeof roles === 'string') roles = [roles];
  const validRoles = ['admin', 'transcriber', 'uploader', 'developer', 'user'];
  roles = roles.filter((r) => validRoles.includes(r));
  const roleStr = roles.length > 0 ? roles.join(',') : 'user';
  try {
    await pool.query(
      `UPDATE users SET display_name = $1, role = $2, is_active = $3, must_change_password = $4, updated_at = NOW() WHERE id = $5`,
      [display_name, roleStr, is_active === 'on', must_change_password === 'on', userId]
    );
    // Reload user for the form
    const result = await pool.query(
      'SELECT id, email, display_name, role, is_active, must_change_password FROM users WHERE id = $1',
      [userId]
    );
    res.render('admin/user-edit', { editUser: result.rows[0], error: null, success: 'User updated.' });
  } catch (err) {
    console.error('User update error:', err);
    const result = await pool.query(
      'SELECT id, email, display_name, role, is_active, must_change_password FROM users WHERE id = $1',
      [userId]
    );
    res.render('admin/user-edit', { editUser: result.rows[0], error: 'Update failed.', success: null });
  }
});

// Toggle require password change (quick action from user list)
router.post('/users/:id/require-password-change', requireRole('admin'), async (req, res) => {
  try {
    await pool.query('UPDATE users SET must_change_password = true, updated_at = NOW() WHERE id = $1', [req.params.id]);
  } catch (err) {
    console.error('Require password change error:', err);
  }
  res.redirect('/admin/users');
});

// Deactivate user (quick action)
router.post('/users/:id/deactivate', requireRole('admin'), async (req, res) => {
  try {
    await pool.query('UPDATE users SET is_active = false, updated_at = NOW() WHERE id = $1', [req.params.id]);
  } catch (err) {
    console.error('Deactivate error:', err);
  }
  res.redirect('/admin/users');
});

// Reactivate user (quick action)
router.post('/users/:id/activate', requireRole('admin'), async (req, res) => {
  try {
    await pool.query('UPDATE users SET is_active = true, updated_at = NOW() WHERE id = $1', [req.params.id]);
  } catch (err) {
    console.error('Activate error:', err);
  }
  res.redirect('/admin/users');
});

// Approve access request
router.post('/requests/:id/approve', requireRole('admin'), async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM access_requests WHERE id = $1', [req.params.id]);
    if (result.rows.length > 0) {
      const request = result.rows[0];
      await pool.query(
        "UPDATE access_requests SET status = 'approved', reviewed_by = $1, reviewed_at = NOW() WHERE id = $2",
        [req.session.userId, req.params.id]
      );
      // Redirect to register page pre-filled (via query params)
      const role = request.role === 'both' ? 'transcriber,uploader' : request.role === 'other' ? 'user' : request.role;
      res.redirect(`/auth/register?name=${encodeURIComponent(request.name)}&email=${encodeURIComponent(request.email)}&role=${encodeURIComponent(role)}`);
      return;
    }
  } catch (err) {
    console.error('Approve request error:', err);
  }
  res.redirect('/admin/users');
});

// Deny access request
router.post('/requests/:id/deny', requireRole('admin'), async (req, res) => {
  try {
    await pool.query(
      "UPDATE access_requests SET status = 'denied', reviewed_by = $1, reviewed_at = NOW() WHERE id = $2",
      [req.session.userId, req.params.id]
    );
  } catch (err) {
    console.error('Deny request error:', err);
  }
  res.redirect('/admin/users');
});

// Reset user password (admin only)
router.post('/users/:id/reset-password', requireRole('admin'), async (req, res) => {
  const userId = parseInt(req.params.id, 10);
  const { new_password } = req.body;
  try {
    if (!new_password || new_password.length < 8) {
      const result = await pool.query(
        'SELECT id, email, display_name, role, is_active, must_change_password FROM users WHERE id = $1',
        [userId]
      );
      return res.render('admin/user-edit', { editUser: result.rows[0], error: 'Password must be at least 8 characters.', success: null });
    }
    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash(new_password, 12);
    await pool.query(
      'UPDATE users SET password_hash = $1, must_change_password = true, updated_at = NOW() WHERE id = $2',
      [hash, userId]
    );
    const result = await pool.query(
      'SELECT id, email, display_name, role, is_active, must_change_password FROM users WHERE id = $1',
      [userId]
    );
    res.render('admin/user-edit', { editUser: result.rows[0], error: null, success: 'Password reset. User will be required to change it on next login.' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.redirect('/admin/users/' + userId + '/edit');
  }
});

// ==========================================================================
// Sermon Management (admin + uploader)
// ==========================================================================

// Helper: get distinct sermon types from DB for the datalist
async function getSermonTypes() {
  try {
    const result = await pool.query('SELECT DISTINCT sermon_type FROM sermons ORDER BY sermon_type');
    const types = result.rows.map((r) => r.sermon_type);
    // Ensure the defaults are always present
    ['sermon', 'funeral', 'special day'].forEach((t) => {
      if (!types.includes(t)) types.push(t);
    });
    return types.sort();
  } catch (err) {
    return ['funeral', 'sermon', 'special day'];
  }
}

// List all sermons
router.get('/sermons', requireRole('admin', 'uploader'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT s.id, s.title, s.sermon_type, s.collection, s.stage, s.transcription_status,
              s.pdf_path, s.created_at, u.display_name AS transcriber_name
       FROM sermons s
       LEFT JOIN users u ON s.transcribed_by = u.id
       ORDER BY s.id`
    );
    res.render('admin/sermons', { sermons: result.rows });
  } catch (err) {
    console.error('Sermon list error:', err);
    res.render('admin/sermons', { sermons: [] });
  }
});

// Add sermon form
router.get('/sermons/add', requireRole('admin', 'uploader'), async (req, res) => {
  const sermonTypes = await getSermonTypes();
  res.render('admin/sermon-add', { error: null, success: null, sermonTypes });
});

// Add sermon POST
router.post('/sermons/add', requireRole('admin', 'uploader'), upload.single('pdf'), async (req, res) => {
  const sermonTypes = await getSermonTypes();
  if (!req.file) {
    return res.render('admin/sermon-add', { error: 'Please select a PDF file.', success: null, sermonTypes });
  }
  const { title, sermon_type, collection, stage } = req.body;
  if (!title || !sermon_type || !collection) {
    return res.render('admin/sermon-add', { error: 'Title, type, and collection are required.', success: null, sermonTypes });
  }
  try {
    const targetStage = stage || 'raw';
    const filename = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const uploaded = await spaces.uploadFile(targetStage, filename, req.file.buffer, req.file.mimetype);

    await pool.query(
      `INSERT INTO sermons (title, sermon_type, collection, pdf_path, stage)
       VALUES ($1, $2, $3, $4, $5)`,
      [title, sermon_type.toLowerCase().trim(), collection, uploaded.url, targetStage]
    );
    await logEvent('sermon_added', `New sermon added: ${title}`, `Type: ${sermon_type}, Collection: ${collection}`, null, req.session.userId);
    await awardUpload(req.session.userId, title, null);
    const updatedTypes = await getSermonTypes();
    res.render('admin/sermon-add', { error: null, success: `"${title}" uploaded and added.`, sermonTypes: updatedTypes });
  } catch (err) {
    console.error('Sermon add error:', err);
    res.render('admin/sermon-add', { error: 'Upload failed: ' + err.message, success: null, sermonTypes });
  }
});

// Edit sermon form
router.get('/sermons/:id/edit', requireRole('admin', 'uploader'), async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM sermons WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.redirect('/admin/sermons');
    const sermonTypes = await getSermonTypes();
    res.render('admin/sermon-edit', { sermon: result.rows[0], error: null, success: null, sermonTypes });
  } catch (err) {
    console.error('Sermon edit error:', err);
    res.redirect('/admin/sermons');
  }
});

// Edit sermon POST
router.post('/sermons/:id/edit', requireRole('admin', 'uploader'), upload.single('pdf'), async (req, res) => {
  const sermonId = parseInt(req.params.id, 10);
  const { title, sermon_type, collection, stage } = req.body;
  try {
    let pdfUrl = null;
    if (req.file) {
      const targetStage = stage || 'processed';
      const filename = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      const uploaded = await spaces.uploadFile(targetStage, filename, req.file.buffer, req.file.mimetype);
      pdfUrl = uploaded.url;
    }

    if (pdfUrl) {
      await pool.query(
        `UPDATE sermons SET title=$1, sermon_type=$2, collection=$3, stage=$4, pdf_path=$5, updated_at=NOW() WHERE id=$6`,
        [title, sermon_type.toLowerCase().trim(), collection, stage, pdfUrl, sermonId]
      );
    } else {
      await pool.query(
        `UPDATE sermons SET title=$1, sermon_type=$2, collection=$3, stage=$4, updated_at=NOW() WHERE id=$5`,
        [title, sermon_type.toLowerCase().trim(), collection, stage, sermonId]
      );
    }
    const result = await pool.query('SELECT * FROM sermons WHERE id = $1', [sermonId]);
    await logEvent('sermon_updated', `Sermon updated: ${title}`, pdfUrl ? 'PDF replaced' : 'Metadata updated', sermonId, req.session.userId);
    const sermonTypes = await getSermonTypes();
    res.render('admin/sermon-edit', { sermon: result.rows[0], error: null, success: 'Sermon updated.', sermonTypes });
  } catch (err) {
    console.error('Sermon update error:', err);
    const result = await pool.query('SELECT * FROM sermons WHERE id = $1', [sermonId]);
    const sermonTypes = await getSermonTypes();
    res.render('admin/sermon-edit', { sermon: result.rows[0] || {}, error: 'Update failed.', success: null, sermonTypes });
  }
});

// Delete sermon
router.post('/sermons/:id/delete', requireRole('admin'), async (req, res) => {
  try {
    const pre = await pool.query('SELECT title FROM sermons WHERE id = $1', [req.params.id]);
    await pool.query('DELETE FROM sermons WHERE id = $1', [req.params.id]);
    if (pre.rows.length > 0) {
      await logEvent('sermon_deleted', `Sermon deleted: ${pre.rows[0].title}`, null, null, req.session.userId);
    }
  } catch (err) {
    console.error('Sermon delete error:', err);
  }
  res.redirect('/admin/sermons');
});

// Move sermon to a different pipeline stage
router.post('/sermons/:id/move', requireRole('admin', 'uploader'), async (req, res) => {
  const { new_stage } = req.body;
  try {
    const result = await pool.query('SELECT pdf_path FROM sermons WHERE id = $1', [req.params.id]);
    if (result.rows.length > 0) {
      const currentUrl = result.rows[0].pdf_path;
      // Extract the key from the CDN URL
      const cdnBase = process.env.DO_SPACES_CDN || 'https://starlingtek-samuel-sermons.nyc3.cdn.digitaloceanspaces.com';
      const key = currentUrl.replace(cdnBase + '/', '');
      const moved = await spaces.moveFile(key, new_stage);
      await pool.query(
        'UPDATE sermons SET pdf_path = $1, stage = $2, updated_at = NOW() WHERE id = $3',
        [moved.url, new_stage, req.params.id]
      );
      await logEvent('stage_changed', `Sermon moved to ${new_stage} stage`, `File: ${key}`, parseInt(req.params.id, 10), req.session.userId);
      await awardStageMove(req.session.userId, key, new_stage, parseInt(req.params.id, 10));
    }
  } catch (err) {
    console.error('Move sermon error:', err);
  }
  res.redirect('/admin/sermons');
});

// ==========================================================================
// Transcription Workbench (admin + transcriber)
// ==========================================================================

// Transcription queue — list sermons needing transcription
router.get('/transcribe', requireRole('admin', 'transcriber'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT s.id, s.title, s.sermon_type, s.collection, s.transcription_status,
              s.updated_at, u.display_name AS transcriber_name
       FROM sermons s
       LEFT JOIN users u ON s.transcribed_by = u.id
       ORDER BY
         CASE s.transcription_status
           WHEN 'in_progress' THEN 1
           WHEN 'not_started' THEN 2
           WHEN 'needs_review' THEN 3
           WHEN 'complete' THEN 4
         END,
         s.id`
    );
    res.render('admin/transcribe-queue', { sermons: result.rows });
  } catch (err) {
    console.error('Transcription queue error:', err);
    res.render('admin/transcribe-queue', { sermons: [] });
  }
});

// Transcription workbench for a specific sermon
router.get('/transcribe/:id', requireRole('admin', 'transcriber'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, title, sermon_type, pdf_path, transcription_text, transcription_status, transcription_notes
       FROM sermons WHERE id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.redirect('/admin/transcribe');
    res.render('admin/transcribe-workbench', { sermon: result.rows[0] });
  } catch (err) {
    console.error('Workbench load error:', err);
    res.redirect('/admin/transcribe');
  }
});

// Auto-save transcription (AJAX endpoint)
router.post('/transcribe/:id/save', requireRole('admin', 'transcriber'), express.json(), async (req, res) => {
  const { text, notes, status } = req.body;
  try {
    const updates = [];
    const values = [];
    let idx = 1;

    if (text !== undefined) {
      updates.push(`transcription_text = $${idx++}`);
      values.push(text);
    }
    if (notes !== undefined) {
      updates.push(`transcription_notes = $${idx++}`);
      values.push(notes);
    }
    if (status) {
      updates.push(`transcription_status = $${idx++}`);
      values.push(status);
    }
    updates.push(`transcribed_by = $${idx++}`);
    values.push(req.session.userId);
    updates.push(`updated_at = NOW()`);

    values.push(req.params.id);
    await pool.query(
      `UPDATE sermons SET ${updates.join(', ')} WHERE id = $${idx}`,
      values
    );
    // Log status changes as events
    if (status) {
      var sermonResult = await pool.query('SELECT title FROM sermons WHERE id = $1', [req.params.id]);
      var sermonTitle = sermonResult.rows.length > 0 ? sermonResult.rows[0].title : 'Unknown';
      var eventMap = {
        'in_progress': 'transcription_started',
        'needs_review': 'transcription_review',
        'complete': 'transcription_complete',
      };
      var eventType = eventMap[status];
      if (eventType) {
        await logEvent(eventType, `Transcription ${status.replace('_', ' ')}: ${sermonTitle}`, null, parseInt(req.params.id, 10), req.session.userId);
      }
      // Award points
      var sid = parseInt(req.params.id, 10);
      if (status === 'in_progress') {
        await awardTranscriptionStarted(req.session.userId, sermonTitle, sid);
      } else if (status === 'complete') {
        var wc = text ? text.trim().split(/\s+/).length : 0;
        await awardTranscriptionComplete(req.session.userId, sermonTitle, wc, sid);
      }
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('Transcription save error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

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
// Peer Review System (admin + transcriber)
// ==========================================================================

// Review queue — sermons needing review that the current user didn't transcribe
router.get('/reviews', requireRole('admin', 'transcriber'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT s.id, s.title, s.sermon_type, s.transcription_status,
              u.display_name AS transcriber_name, s.updated_at,
              (SELECT COUNT(*) FROM sermon_reviews r WHERE r.sermon_id = s.id AND r.status = 'pending') AS pending_reviews
       FROM sermons s
       LEFT JOIN users u ON s.transcribed_by = u.id
       WHERE s.transcription_status = 'needs_review'
         AND (s.transcribed_by IS NULL OR s.transcribed_by != $1)
       ORDER BY s.updated_at DESC`,
      [req.session.userId]
    );
    res.render('admin/review-queue', { sermons: result.rows });
  } catch (err) {
    console.error('Review queue error:', err);
    res.render('admin/review-queue', { sermons: [] });
  }
});

// Claim a review
router.post('/reviews/:sermonId/claim', requireRole('admin', 'transcriber'), async (req, res) => {
  const sermonId = parseInt(req.params.sermonId, 10);
  try {
    // Check they didn't transcribe it
    const sermon = await pool.query('SELECT transcribed_by FROM sermons WHERE id = $1', [sermonId]);
    if (sermon.rows.length > 0 && sermon.rows[0].transcribed_by === req.session.userId) {
      return res.redirect('/admin/reviews');
    }
    // Check for existing pending review by this user
    const existing = await pool.query(
      "SELECT id FROM sermon_reviews WHERE sermon_id = $1 AND reviewer_id = $2 AND status = 'pending'",
      [sermonId, req.session.userId]
    );
    if (existing.rows.length === 0) {
      await pool.query(
        'INSERT INTO sermon_reviews (sermon_id, reviewer_id, status) VALUES ($1, $2, $3)',
        [sermonId, req.session.userId, 'pending']
      );
    }
    res.redirect('/admin/reviews/' + sermonId);
  } catch (err) {
    console.error('Claim review error:', err);
    res.redirect('/admin/reviews');
  }
});

// Review workbench
router.get('/reviews/:sermonId', requireRole('admin', 'transcriber'), async (req, res) => {
  const sermonId = parseInt(req.params.sermonId, 10);
  try {
    const sermonResult = await pool.query(
      `SELECT s.*, u.display_name AS transcriber_name
       FROM sermons s LEFT JOIN users u ON s.transcribed_by = u.id
       WHERE s.id = $1`,
      [sermonId]
    );
    if (sermonResult.rows.length === 0) return res.redirect('/admin/reviews');
    const sermon = sermonResult.rows[0];

    // Get or create review
    let reviewResult = await pool.query(
      "SELECT id FROM sermon_reviews WHERE sermon_id = $1 AND reviewer_id = $2 AND status = 'pending'",
      [sermonId, req.session.userId]
    );
    let reviewId;
    if (reviewResult.rows.length === 0) {
      const ins = await pool.query(
        'INSERT INTO sermon_reviews (sermon_id, reviewer_id) VALUES ($1, $2) RETURNING id',
        [sermonId, req.session.userId]
      );
      reviewId = ins.rows[0].id;
    } else {
      reviewId = reviewResult.rows[0].id;
    }

    // Get comments
    const commentsResult = await pool.query(
      `SELECT c.*, u.display_name AS author_name
       FROM review_comments c
       JOIN users u ON c.author_id = u.id
       WHERE c.review_id = $1
       ORDER BY c.created_at ASC`,
      [reviewId]
    );

    res.render('admin/review-workbench', {
      sermon, reviewId, comments: commentsResult.rows,
    });
  } catch (err) {
    console.error('Review workbench error:', err);
    res.redirect('/admin/reviews');
  }
});

// Add a comment
router.post('/reviews/:reviewId/comment', requireRole('admin', 'transcriber'), async (req, res) => {
  const { comment_text, passage_ref, sermon_id } = req.body;
  try {
    await pool.query(
      'INSERT INTO review_comments (review_id, author_id, comment_text, passage_ref) VALUES ($1, $2, $3, $4)',
      [req.params.reviewId, req.session.userId, comment_text, passage_ref || null]
    );
    await awardPoints(req.session.userId, 5, 'review_comment', 'Review comment', parseInt(sermon_id, 10));
    res.redirect('/admin/reviews/' + sermon_id);
  } catch (err) {
    console.error('Add comment error:', err);
    res.redirect('/admin/reviews');
  }
});

// Resolve a comment
router.post('/reviews/comment/:commentId/resolve', requireRole('admin', 'transcriber'), async (req, res) => {
  const { sermon_id } = req.body;
  try {
    await pool.query('UPDATE review_comments SET is_resolved = true WHERE id = $1', [req.params.commentId]);
    res.redirect('/admin/reviews/' + sermon_id);
  } catch (err) {
    console.error('Resolve comment error:', err);
    res.redirect('/admin/reviews');
  }
});

// Approve transcription
router.post('/reviews/:reviewId/approve', requireRole('admin', 'transcriber'), async (req, res) => {
  const { sermon_id } = req.body;
  const sid = parseInt(sermon_id, 10);
  try {
    await pool.query(
      "UPDATE sermon_reviews SET status = 'approved', completed_at = NOW() WHERE id = $1",
      [req.params.reviewId]
    );
    await pool.query(
      "UPDATE sermons SET transcription_status = 'complete', updated_at = NOW() WHERE id = $1",
      [sid]
    );
    // Award points
    const isFirst = await pool.query(
      "SELECT COUNT(*) FROM user_points WHERE user_id = $1 AND reason = 'review_complete'",
      [req.session.userId]
    );
    await awardPoints(req.session.userId, 75, 'review_complete', 'Approved transcription', sid);
    if (parseInt(isFirst.rows[0].count, 10) === 0) {
      await awardPoints(req.session.userId, 25, 'bonus_first_review', 'First review completed!', sid);
    }
    // Log event
    await logEvent('transcription_complete', 'Transcription approved via review', null, sid, req.session.userId);
    res.redirect('/admin/reviews');
  } catch (err) {
    console.error('Approve error:', err);
    res.redirect('/admin/reviews');
  }
});

// Request changes
router.post('/reviews/:reviewId/request-changes', requireRole('admin', 'transcriber'), async (req, res) => {
  const { sermon_id } = req.body;
  try {
    await pool.query(
      "UPDATE sermon_reviews SET status = 'changes_requested', completed_at = NOW() WHERE id = $1",
      [req.params.reviewId]
    );
    await pool.query(
      "UPDATE sermons SET transcription_status = 'in_progress', updated_at = NOW() WHERE id = $1",
      [sermon_id]
    );
    await awardPoints(req.session.userId, 75, 'review_complete', 'Reviewed (changes requested)', parseInt(sermon_id, 10));
    res.redirect('/admin/reviews');
  } catch (err) {
    console.error('Request changes error:', err);
    res.redirect('/admin/reviews');
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
