const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { requireLogin, requireRole } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

// Create issue form (all logged-in users)
router.get('/new', requireLogin, (req, res) => {
  res.render('issues/new', { error: null, success: null, pageTitle: 'Report an Issue' });
});

// Submit issue
router.post('/new', requireLogin,
  body('title').trim().isLength({ min: 3, max: 255 }).withMessage('Title must be 3-255 characters.'),
  body('description').trim().isLength({ min: 10, max: 5000 }).withMessage('Description must be at least 10 characters.'),
  body('category').isIn(['bug', 'feature', 'question', 'other']),
  body('priority').isIn(['low', 'medium', 'high']),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.render('issues/new', { error: errors.array().map(e => e.msg).join(' '), success: null, pageTitle: 'Report an Issue' });
    }
    try {
      await pool.query(
        'INSERT INTO issues (title, description, category, priority, created_by) VALUES ($1, $2, $3, $4, $5)',
        [req.body.title, req.body.description, req.body.category, req.body.priority, req.session.userId]
      );
      res.render('issues/new', { error: null, success: 'Issue submitted. The development team will review it.', pageTitle: 'Report an Issue' });
    } catch (err) {
      console.error('Create issue error:', err);
      res.render('issues/new', { error: 'Something went wrong.', success: null, pageTitle: 'Report an Issue' });
    }
  }
);

// My issues (all logged-in users can see their own)
router.get('/mine', requireLogin, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM issues WHERE created_by = $1 ORDER BY created_at DESC',
      [req.session.userId]
    );
    res.render('issues/mine', { issues: result.rows, pageTitle: 'My Issues' });
  } catch (err) {
    console.error('My issues error:', err);
    res.render('issues/mine', { issues: [], pageTitle: 'My Issues' });
  }
});

// Issue dashboard (developer + admin only)
router.get('/', requireRole('admin', 'developer'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT i.*, u.display_name AS reporter_name, a.display_name AS assignee_name
       FROM issues i
       LEFT JOIN users u ON i.created_by = u.id
       LEFT JOIN users a ON i.assigned_to = a.id
       ORDER BY
         CASE i.status WHEN 'open' THEN 1 WHEN 'in_progress' THEN 2 WHEN 'closed' THEN 3 END,
         CASE i.priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END,
         i.created_at DESC`
    );
    res.render('issues/dashboard', { issues: result.rows, pageTitle: 'Issue Tracker' });
  } catch (err) {
    console.error('Issue dashboard error:', err);
    res.render('issues/dashboard', { issues: [], pageTitle: 'Issue Tracker' });
  }
});

// Update issue status (developer + admin)
router.post('/:id/status', requireRole('admin', 'developer'), async (req, res) => {
  const { status } = req.body;
  if (['open', 'in_progress', 'closed'].includes(status)) {
    try {
      await pool.query('UPDATE issues SET status = $1, updated_at = NOW() WHERE id = $2', [status, req.params.id]);
    } catch (err) {
      console.error('Update issue status error:', err);
    }
  }
  res.redirect('/issues');
});

// Assign issue (developer + admin)
router.post('/:id/assign', requireRole('admin', 'developer'), async (req, res) => {
  try {
    await pool.query('UPDATE issues SET assigned_to = $1, status = $2, updated_at = NOW() WHERE id = $3',
      [req.session.userId, 'in_progress', req.params.id]);
  } catch (err) {
    console.error('Assign issue error:', err);
  }
  res.redirect('/issues');
});

module.exports = router;
