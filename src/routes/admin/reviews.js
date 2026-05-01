const express = require('express');
const router = express.Router();
const pool = require('../../db/pool');
const { requireRole } = require('../../middleware/auth');
const { logEvent } = require('../../utils/events');
const { awardPoints } = require('../../utils/points');

// ==========================================================================
// Peer Review System (admin + transcriber)
// ==========================================================================

// Review queue — sermons needing review that the current user didn't transcribe
router.get('/', requireRole('admin', 'transcriber'), async (req, res) => {
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
router.post('//:sermonId/claim', requireRole('admin', 'transcriber'), async (req, res) => {
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
router.get('//:sermonId', requireRole('admin', 'transcriber'), async (req, res) => {
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
router.post('//:reviewId/comment', requireRole('admin', 'transcriber'), async (req, res) => {
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
router.post('//comment/:commentId/resolve', requireRole('admin', 'transcriber'), async (req, res) => {
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
router.post('//:reviewId/approve', requireRole('admin', 'transcriber'), async (req, res) => {
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
router.post('//:reviewId/request-changes', requireRole('admin', 'transcriber'), async (req, res) => {
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

module.exports = router;
