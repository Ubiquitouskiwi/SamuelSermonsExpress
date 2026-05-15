const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { body, validationResult } = require('express-validator');
const { logEvent } = require('../utils/events');
const { findMatchingBlock } = require('../utils/blocklist');

router.get('/', (req, res) => {
  res.render('contact', { error: null, success: null, pageTitle: 'Join the Team' });
});

router.post('/',
  body('name').trim().isLength({ min: 1, max: 100 }).withMessage('Name is required.'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required.'),
  body('role').isIn(['transcriber', 'uploader', 'both', 'other']).withMessage('Please select a role.'),
  body('message').trim().isLength({ max: 1000 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.render('contact', { error: errors.array().map(e => e.msg).join(' '), success: null, pageTitle: 'Join the Team' });
    }
    const { name, email, role, message } = req.body;
    try {
      const matchedId = await findMatchingBlock({ name, email });
      if (matchedId !== null) {
        await logEvent('access_request_blocked', 'Blocked access request from ' + name, 'Email: ' + email + '; matched blocklist entry ' + matchedId, null, null);
        return res.render('contact', { error: null, success: 'Thanks! Your request has been sent. We\'ll be in touch soon.', pageTitle: 'Join the Team' });
      }
      // Store in access_requests table for admin review
      await pool.query(
        'INSERT INTO access_requests (name, email, role, message) VALUES ($1, $2, $3, $4)',
        [name, email, role, message || null]
      );
      // Also log as event for the activity feed
      await logEvent('access_request', `Access request from ${name}`, `Email: ${email}, Role: ${role}`, null, null);
      res.render('contact', { error: null, success: 'Thanks! Your request has been sent. We\'ll be in touch soon.', pageTitle: 'Join the Team' });
    } catch (err) {
      console.error('Contact form error:', err);
      res.render('contact', { error: 'Something went wrong. Please try again or email admin@samuelsermons.com directly.', success: null, pageTitle: 'Join the Team' });
    }
  }
);

module.exports = router;
