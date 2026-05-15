/**
 * Admin blocklist sub-router.
 *
 * Manages entries in the request_blocklist table used to silently reject
 * matching access requests on the public contact page. Every route below
 * is admin-gated via the router-level `requireRole('admin')` middleware.
 */
const express = require('express');
const router = express.Router();
const pool = require('../../db/pool');
const { requireRole } = require('../../middleware/auth');
const { validateRegex } = require('../../utils/blocklist');

// All routes on this sub-router require the admin role. Non-admins receive
// the standard 403 page rendered by requireRole.
router.use(requireRole('admin'));

// Load every blocklist entry joined with the creating admin's display name.
// Used by the GET handler and by the POST /add handler when re-rendering
// after a validation or duplicate failure.
async function loadEntries() {
  const result = await pool.query(
    `SELECT b.id, b.block_type, b.pattern, b.is_regex, b.reason, b.created_at,
            u.display_name AS created_by_name
     FROM request_blocklist b
     LEFT JOIN users u ON b.created_by = u.id
     ORDER BY b.created_at DESC`
  );
  return result.rows;
}

// GET /admin/blocklist — render the management page with the existing
// entries, the add form (optionally pre-filled from query parameters), and
// any one-shot flash message left by a prior add/remove redirect.
router.get('/', async (req, res) => {
  const prefill = {
    type: req.query.prefill_type || null,
    email: req.query.prefill_email || null,
    name: req.query.prefill_name || null,
  };
  const flash = req.session.flash || null;
  if (req.session.flash) delete req.session.flash;
  try {
    const entries = await loadEntries();
    res.render('admin/blocklist', {
      entries,
      prefill,
      flash,
      error: null,
      formValues: null,
    });
  } catch (err) {
    console.error('Blocklist list error:', err);
    res.render('admin/blocklist', {
      entries: [],
      prefill,
      flash,
      error: null,
      formValues: null,
    });
  }
});

// POST /admin/blocklist/add — validate the submitted form and insert a new
// entry. On any validation failure, on a regex compile failure, or on a
// duplicate `(block_type, pattern)` insert, re-render the page with the
// admin's submitted values preserved and an error message describing what
// went wrong. On success, set a one-shot success flash and redirect back
// to the management page.
router.post('/add', async (req, res) => {
  const block_type = req.body.block_type;
  const pattern = typeof req.body.pattern === 'string' ? req.body.pattern.trim() : '';
  const reason = typeof req.body.reason === 'string' ? req.body.reason.trim() : '';
  const is_regex = req.body.is_regex === 'on' || req.body.is_regex === 'true';

  // Form values to echo back when re-rendering after a validation failure
  // so the admin doesn't have to retype everything.
  const formValues = { block_type, pattern, is_regex, reason };

  const renderError = async (error) => {
    try {
      const entries = await loadEntries();
      res.render('admin/blocklist', {
        entries,
        prefill: { type: null, email: null, name: null },
        flash: null,
        error,
        formValues,
      });
    } catch (loadErr) {
      console.error('Blocklist list error:', loadErr);
      res.render('admin/blocklist', {
        entries: [],
        prefill: { type: null, email: null, name: null },
        flash: null,
        error,
        formValues,
      });
    }
  };

  // Validate in order: block_type, pattern length, reason length, regex.
  if (block_type !== 'email' && block_type !== 'name') {
    return renderError("Block type must be 'email' or 'name'.");
  }
  if (pattern.length < 1 || pattern.length > 500) {
    return renderError('Pattern is required and must be at most 500 characters.');
  }
  if (reason.length > 500) {
    return renderError('Reason must be at most 500 characters.');
  }
  if (is_regex) {
    const regexError = validateRegex(pattern);
    if (regexError !== null) {
      return renderError('Invalid regex: ' + regexError + '.');
    }
  }

  try {
    await pool.query(
      `INSERT INTO request_blocklist (block_type, pattern, is_regex, reason, created_by)
       VALUES ($1, $2, $3, $4, $5)`,
      [block_type, pattern, is_regex, reason || null, req.session.userId]
    );
  } catch (err) {
    if (err && err.code === '23505') {
      return renderError('A block with this pattern already exists.');
    }
    console.error('Blocklist add error:', err);
    return renderError('Could not add block. Please try again.');
  }

  req.session.flash = {
    type: 'success',
    message: 'Added block "' + pattern + '".',
  };
  res.redirect('/admin/blocklist');
});

// POST /admin/blocklist/:id/remove — delete the entry by id and redirect
// back to the management page with a one-shot flash banner. Missing or
// malformed ids produce an error flash; successful deletes echo the
// removed pattern in the success flash.
router.post('/:id/remove', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || String(id) !== String(req.params.id).trim()) {
    req.session.flash = {
      type: 'error',
      message: 'That block could not be found.',
    };
    return res.redirect('/admin/blocklist');
  }

  try {
    const result = await pool.query(
      'DELETE FROM request_blocklist WHERE id = $1 RETURNING pattern',
      [id]
    );
    if (result.rowCount === 0) {
      req.session.flash = {
        type: 'error',
        message: 'That block could not be found.',
      };
    } else {
      req.session.flash = {
        type: 'success',
        message: 'Removed block "' + result.rows[0].pattern + '".',
      };
    }
  } catch (err) {
    console.error('Blocklist remove error:', err);
    req.session.flash = {
      type: 'error',
      message: 'Could not remove block. Please try again.',
    };
  }

  res.redirect('/admin/blocklist');
});

module.exports = router;
