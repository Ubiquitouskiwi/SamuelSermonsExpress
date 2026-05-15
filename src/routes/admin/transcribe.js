const express = require('express');
const router = express.Router();
const pool = require('../../db/pool');
const { requireRole } = require('../../middleware/auth');
const { logEvent } = require('../../utils/events');
const { awardPoints, awardTranscriptionStarted, awardTranscriptionComplete } = require('../../utils/points');

// ==========================================================================
// Transcription Workbench (admin + transcriber)
// ==========================================================================

// Transcription queue — list sermons needing transcription
router.get('/', requireRole('admin', 'transcriber'), async (req, res) => {
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
router.get('/:id', requireRole('admin', 'transcriber'), async (req, res) => {
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
router.post('/:id/save', requireRole('admin', 'transcriber'), express.json(), async (req, res) => {
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

module.exports = router;
