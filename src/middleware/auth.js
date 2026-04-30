/**
 * Authentication and authorization middleware.
 * Roles are stored as comma-separated strings (e.g. "developer,uploader").
 */
const pool = require('../db/pool');

/**
 * Parse a role string into an array.
 */
function parseRoles(roleStr) {
  if (!roleStr) return [];
  return roleStr.split(',').map(function (r) { return r.trim(); }).filter(Boolean);
}

/**
 * Check if a user's roles include any of the required roles.
 * Admin always passes.
 */
function hasAnyRole(userRoleStr, requiredRoles) {
  var userRoles = parseRoles(userRoleStr);
  if (userRoles.includes('admin')) return true;
  return requiredRoles.some(function (r) { return userRoles.includes(r); });
}

/**
 * Require the user to be logged in.
 */
function requireLogin(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }
  req.session.returnTo = req.originalUrl;
  res.redirect('/auth/login');
}

/**
 * Require at least one of the specified roles.
 * Admin role always has access.
 */
function requireRole() {
  var roles = Array.prototype.slice.call(arguments);
  return function (req, res, next) {
    if (!req.session || !req.session.userId) {
      req.session.returnTo = req.originalUrl;
      return res.redirect('/auth/login');
    }
    if (hasAnyRole(req.session.userRole, roles)) {
      return next();
    }
    res.status(403).render('error', {
      message: 'Access denied',
      error: { status: 403 },
    });
  };
}

/**
 * Check if the user has specific permissions (via the permissions table).
 * Aggregates permissions across all of the user's roles.
 */
function requirePermission() {
  var permissions = Array.prototype.slice.call(arguments);
  return async function (req, res, next) {
    if (!req.session || !req.session.userId) {
      req.session.returnTo = req.originalUrl;
      return res.redirect('/auth/login');
    }
    try {
      var userRoles = parseRoles(req.session.userRole);
      if (userRoles.length === 0) {
        return res.status(403).render('error', { message: 'Access denied', error: { status: 403 } });
      }
      // Build parameterized query for all roles
      var placeholders = userRoles.map(function (_, i) { return '$' + (i + 1); }).join(', ');
      var result = await pool.query(
        'SELECT DISTINCT permission FROM permissions WHERE role IN (' + placeholders + ')',
        userRoles
      );
      var userPerms = result.rows.map(function (r) { return r.permission; });
      if (userPerms.includes('all')) return next();
      var hasAll = permissions.every(function (p) { return userPerms.includes(p); });
      if (hasAll) return next();
      res.status(403).render('error', { message: 'Access denied', error: { status: 403 } });
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Load user data into res.locals for templates.
 * Adds a `roles` array for easy template checks.
 */
async function loadUser(req, res, next) {
  res.locals.currentUser = null;
  res.locals.showWelcome = false;
  if (req.session && req.session.userId) {
    try {
      var result = await pool.query(
        'SELECT id, email, display_name, role, must_change_password, preferences, total_points, avatar FROM users WHERE id = $1 AND is_active = true',
        [req.session.userId]
      );
      if (result.rows.length > 0) {
        var user = result.rows[0];
        user.roles = parseRoles(user.role);
        var { getAvatar } = require('../utils/avatars');
        user.avatarData = getAvatar(user.avatar);
        res.locals.currentUser = user;
        // Check if we should show the welcome modal
        if (req.session.showWelcome && !(user.preferences && user.preferences.welcome_dismissed)) {
          res.locals.showWelcome = true;
          delete req.session.showWelcome;
        }
      } else {
        req.session.destroy();
      }
    } catch (err) {
      console.error('Failed to load user:', err.message);
    }
  }
  next();
}

/**
 * Redirect users who must change their password.
 */
function requirePasswordChange(req, res, next) {
  if (!res.locals.currentUser) return next();
  if (!res.locals.currentUser.must_change_password) return next();
  var allowed = ['/auth/change-password', '/auth/logout'];
  if (allowed.includes(req.path)) return next();
  if (req.path.startsWith('/stylesheets/') || req.path.startsWith('/javascripts/') || req.path.startsWith('/images/')) return next();
  return res.redirect('/auth/change-password');
}

module.exports = { requireLogin, requireRole, requirePermission, loadUser, requirePasswordChange, parseRoles, hasAnyRole };
