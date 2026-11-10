const pool = require('../db/pool');
const asyncHandler = require('express-async-handler');
const createError = require('http-errors');
const seo = require('../utils/seo');

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

  res.render('sermons', { orderedSermons, unorderedSermons, pageTitle: 'Sermons', pageScreenshot: 'sermons' });
});

// Display detail page for sermon
exports.sermon_detail = asyncHandler(async (req, res, next) => {
  // Only plain positive integers are sermon ids; anything else is a missing page (404), not a bad request
  const sermonId = /^\d+$/.test(req.query.id || '') ? parseInt(req.query.id, 10) : NaN;
  if (isNaN(sermonId) || sermonId < 1) {
    return next(createError(404, 'Sermon not found'));
  }

  // Try DB first
  let sermon = null;
  let neighbors = null;
  try {
    const result = await pool.query(
      'SELECT id, title, sermon_type AS "sermonType", collection, pdf_path AS "imageLink", transcription_text AS "transcriptionText", transcription_status AS "transcriptionStatus" FROM sermons WHERE id = $1',
      [sermonId]
    );
    if (result.rows.length > 0) {
      sermon = result.rows[0];
      const near = await pool.query(
        `SELECT id, title FROM sermons
         WHERE id = (SELECT MAX(id) FROM sermons WHERE id < $1)
            OR id = (SELECT MIN(id) FROM sermons WHERE id > $1)`,
        [sermonId]
      );
      neighbors = near.rows;
    }
  } catch (err) {
    console.warn('DB query failed, using hardcoded data:', err.message);
  }

  // Fallback to hardcoded data
  if (!sermon) {
    const all = orderedSermonData.concat(unorderedSermonData);
    sermon = all.find((s) => s.id === sermonId) || null;
    neighbors = all;
  }

  if (!sermon) {
    return next(createError(404, 'Sermon not found'));
  }

  // Previous/next by id, from either the DB rows or the fallback list
  const prevSermon = neighbors.filter((s) => s.id < sermonId).sort((a, b) => b.id - a.id)[0] || null;
  const nextSermon = neighbors.filter((s) => s.id > sermonId).sort((a, b) => a.id - b.id)[0] || null;

  const displayTitle = splitTitle(sermon.title);
  const pageDescription = seo.summarize(sermon.transcriptionText)
    || 'Read "' + sermon.title + '" — a ' + sermon.sermonType + ' by Rev. Samuel Starling.';

  res.render('sermon_detail', {
    sermon,
    prevSermon,
    nextSermon,
    splitTitle,
    pageTitle: sermon.title,
    pageDescription,
    jsonLd: seo.sermonJsonLd(sermon, displayTitle, pageDescription),
  });
});

// Ordered sermons carry their number as a "12. " prefix; strip it for display
function splitTitle(title) {
  const m = /^(\d+)\.\s+(.+)$/.exec(title || '');
  return m ? m[2] : (title || '');
}

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
