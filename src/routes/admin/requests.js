/**
 * Access request review routes (admin only).
 * Mounted at /admin/requests by src/routes/admin.js.
 */
const express = require('express');
const router = express.Router();
const pool = require('../../db/pool');
const { requireRole } = require('../../middleware/auth');

// Approve access request
router.post('/:id/approve', requireRole('admin'), async (req, res) => {
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
router.post('/:id/deny', requireRole('admin'), async (req, res) => {
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

module.exports = router;
