const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const pool = require('../db/pool');
const { requireLogin, requireRole } = require('../middleware/auth');

// --- Login ---
router.get('/login', (req, res) => {
  if (req.session.userId) return res.redirect('/');
  res.render('auth/login', { error: null });
});

router.post(
  '/login',
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.render('auth/login', { error: 'Please enter a valid email and password.' });
    }
    try {
      const result = await pool.query(
        'SELECT id, email, display_name, password_hash, role, is_active, must_change_password FROM users WHERE email = $1',
        [req.body.email]
      );
      const user = result.rows[0];
      if (!user || !user.is_active) {
        return res.render('auth/login', { error: 'Invalid email or password.' });
      }
      const match = await bcrypt.compare(req.body.password, user.password_hash);
      if (!match) {
        return res.render('auth/login', { error: 'Invalid email or password.' });
      }
      // Record last login
      await pool.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);

      // Regenerate session to prevent fixation
      req.session.regenerate((err) => {
        if (err) return res.render('auth/login', { error: 'Session error. Please try again.' });
        req.session.userId = user.id;
        req.session.userRole = user.role;
        req.session.displayName = user.display_name;
        req.session.showWelcome = true; // Check preferences on next page load

        // If must change password, go straight there
        if (user.must_change_password) {
          return res.redirect('/auth/change-password');
        }

        const returnTo = req.session.returnTo || '/';
        delete req.session.returnTo;
        res.redirect(returnTo);
      });
    } catch (err) {
      console.error('Login error:', err);
      res.render('auth/login', { error: 'Something went wrong. Please try again.' });
    }
  }
);

// --- Logout ---
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) console.error('Logout error:', err);
    res.redirect('/');
  });
});

// --- Change Password ---
router.get('/change-password', requireLogin, (req, res) => {
  const forced = res.locals.currentUser && res.locals.currentUser.must_change_password;
  res.render('auth/change-password', { error: null, forced });
});

router.post(
  '/change-password',
  requireLogin,
  body('new_password').isLength({ min: 8 }).withMessage('New password must be at least 8 characters.'),
  body('confirm_password').custom((val, { req }) => {
    if (val !== req.body.new_password) throw new Error('Passwords do not match.');
    return true;
  }),
  async (req, res) => {
    const forced = res.locals.currentUser && res.locals.currentUser.must_change_password;
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.render('auth/change-password', {
        error: errors.array().map((e) => e.msg).join(' '),
        forced,
      });
    }
    try {
      // If not a forced change, require current password
      if (!forced) {
        if (!req.body.current_password) {
          return res.render('auth/change-password', { error: 'Current password is required.', forced });
        }
        const result = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.session.userId]);
        const match = await bcrypt.compare(req.body.current_password, result.rows[0].password_hash);
        if (!match) {
          return res.render('auth/change-password', { error: 'Current password is incorrect.', forced });
        }
      }
      const hash = await bcrypt.hash(req.body.new_password, 12);
      await pool.query(
        'UPDATE users SET password_hash = $1, must_change_password = false, updated_at = NOW() WHERE id = $2',
        [hash, req.session.userId]
      );
      req.session.showWelcome = true;
      res.redirect('/admin');
    } catch (err) {
      console.error('Change password error:', err);
      res.render('auth/change-password', { error: 'Something went wrong.', forced });
    }
  }
);

// --- Register (admin-only: admins create accounts for their team) ---
router.get('/register', requireRole('admin'), (req, res) => {
  res.render('auth/register', {
    error: null, success: null,
    prefill: { name: req.query.name || '', email: req.query.email || '', role: req.query.role || '' },
    pageTitle: 'Create Account'
  });
});

router.post(
  '/register',
  requireRole('admin'),
  body('email').isEmail().normalizeEmail(),
  body('display_name').trim().isLength({ min: 1, max: 255 }),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters.'),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.render('auth/register', {
        error: errors.array().map((e) => e.msg).join(' '),
        success: null,
      });
    }
    // Collect roles from checkboxes (can be string or array)
    let roles = req.body.roles || [];
    if (typeof roles === 'string') roles = [roles];
    const validRoles = ['admin', 'transcriber', 'uploader', 'developer', 'user'];
    roles = roles.filter((r) => validRoles.includes(r));
    if (roles.length === 0) {
      return res.render('auth/register', { error: 'Please select at least one role.', success: null });
    }
    const roleStr = roles.join(',');
    try {
      const hash = await bcrypt.hash(req.body.password, 12);
      await pool.query(
        'INSERT INTO users (email, display_name, password_hash, role, must_change_password) VALUES ($1, $2, $3, $4, true)',
        [req.body.email, req.body.display_name, hash, roleStr]
      );
      res.render('auth/register', {
        error: null,
        success: `Account created for ${req.body.email} (${roleStr}). They will be required to change their password on first login.`,
      });
    } catch (err) {
      if (err.code === '23505') {
        return res.render('auth/register', { error: 'That email is already registered.', success: null });
      }
      console.error('Register error:', err);
      res.render('auth/register', { error: 'Something went wrong.', success: null });
    }
  }
);

module.exports = router;
