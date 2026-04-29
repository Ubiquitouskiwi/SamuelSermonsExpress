const pool = require('../db/pool');
const asyncHandler = require('express-async-handler');
const createError = require('http-errors');

// Fallback to hardcoded data if DB is not available yet
const orderedSermonData = require('../utils/orderedSermonData');
const unorderedSermonData = require('../utils/unorderedSermonData');

/**
 * Try to load sermons from DB; fall back to hardcoded data.
 */
async function getSermonsFromDB() {
  try {
    const result = await pool.query(
      'SELECT id, title, sermon_type AS "sermonType", collection, pdf_path AS "imageLink" FROM sermons ORDER BY id'
    );
    if (result.rows.length > 0) {
      const ordered = result.rows.filter((s) => s.collection === 'ordered');
      const unordered = result.rows.filter((s) => s.collection === 'unordered');
      return { ordered, unordered };
    }
  } catch (err) {
    // DB not ready yet — fall back silently
    console.warn('DB query failed, using hardcoded data:', err.message);
  }
  return null;
}

// Display Sermons page
exports.index = asyncHandler(async (req, res) => {
  const dbData = await getSermonsFromDB();
  let orderedSermons, unorderedSermons;

  if (dbData) {
    orderedSermons = dbData.ordered;
    unorderedSermons = dbData.unordered.length > 0 ? dbData.unordered : null;
  } else {
    orderedSermons = orderedSermonData;
    unorderedSermons = unorderedSermonData.length > 0 ? unorderedSermonData : null;
  }

  res.render('sermons', { orderedSermons, unorderedSermons, pageTitle: 'Sermons' });
});

// Display detail page for sermon
exports.sermon_detail = asyncHandler(async (req, res, next) => {
  const sermonId = parseInt(req.query.id, 10);
  if (isNaN(sermonId)) {
    return next(createError(400, 'Invalid sermon ID'));
  }

  // Try DB first
  let sermon = null;
  try {
    const result = await pool.query(
      'SELECT id, title, sermon_type AS "sermonType", collection, pdf_path AS "imageLink", transcription_text AS "transcriptionText", transcription_status AS "transcriptionStatus" FROM sermons WHERE id = $1',
      [sermonId]
    );
    if (result.rows.length > 0) {
      sermon = result.rows[0];
    }
  } catch (err) {
    console.warn('DB query failed, using hardcoded data:', err.message);
  }

  // Fallback to hardcoded data
  if (!sermon) {
    sermon = orderedSermonData.find((s) => s.id === sermonId)
      || unorderedSermonData.find((s) => s.id === sermonId)
      || null;
  }

  if (!sermon) {
    return next(createError(404, 'Sermon not found'));
  }

  res.render('sermon_detail', { sermon, pageTitle: sermon.title, pageDescription: 'Read "' + sermon.title + '" — a ' + sermon.sermonType + ' by Rev. Samuel Starling.' });
});

// Display Sermon create page on GET
exports.sermon_create_get = asyncHandler(async (req, res) => {
  res.render('sermon_create');
});

// Handle Sermon create on POST
exports.sermons_create_post = asyncHandler(async (req, res) => {
  res.send('NOT IMPLEMENTED: Sermon create POST');
});

// Display Sermon delete form on GET
exports.sermons_delete_get = asyncHandler(async (req, res) => {
  res.send('NOT IMPLEMENTED: Sermon delete form on GET');
});

// Handle Sermon delete on POST
exports.sermons_delete_post = asyncHandler(async (req, res) => {
  res.send('NOT IMPLEMENTED: Sermon delete on POST');
});

// Display Sermon update form on GET
exports.sermons_update_get = asyncHandler(async (req, res) => {
  res.send('NOT IMPLEMENTED: Sermon update form on GET');
});

// Handle Sermon update on POST
exports.sermons_update_post = asyncHandler(async (req, res) => {
  res.send('NOT IMPLEMENTED: Sermon update on POST');
});
