const express = require('express');
const router = express.Router();
const pool = require('../../db/pool');
const { requireRole } = require('../../middleware/auth');
const upload = require('../../middleware/upload');
const spaces = require('../../utils/spaces');
const { logEvent } = require('../../utils/events');
const { awardUpload, awardStageMove } = require('../../utils/points');

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
router.get('/', requireRole('admin', 'uploader'), async (req, res) => {
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
router.get('/add', requireRole('admin', 'uploader'), async (req, res) => {
  const sermonTypes = await getSermonTypes();
  res.render('admin/sermon-add', { error: null, success: null, sermonTypes });
});

// Add sermon POST
router.post('/add', requireRole('admin', 'uploader'), upload.single('pdf'), async (req, res) => {
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
router.get('/:id/edit', requireRole('admin', 'uploader'), async (req, res) => {
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
router.post('/:id/edit', requireRole('admin', 'uploader'), upload.single('pdf'), async (req, res) => {
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
router.post('/:id/delete', requireRole('admin'), async (req, res) => {
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
router.post('/:id/move', requireRole('admin', 'uploader'), async (req, res) => {
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

module.exports = router;
