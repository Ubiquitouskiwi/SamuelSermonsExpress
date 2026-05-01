const express = require('express');
const router = express.Router();
const pool = require('../../db/pool');
const { requireRole } = require('../../middleware/auth');
const { awardPoints } = require('../../utils/points');

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

module.exports = router;
