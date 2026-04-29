var createError = require('http-errors');
var express = require('express');
var path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

var cookieParser = require('cookie-parser');
var logger = require('morgan');
var helmet = require('helmet');
var rateLimit = require('express-rate-limit');
var session = require('express-session');
var PgSession = require('connect-pg-simple')(session);
var pool = require('./db/pool');
var { loadUser, requirePasswordChange } = require('./middleware/auth');

// Routes
var indexRouter = require('./routes/index');
var sermonsRouter = require('./routes/sermons');
var aboutRouter = require('./routes/about');
var authRouter = require('./routes/auth');
var adminRouter = require('./routes/admin');
var feedRouter = require('./routes/feed');
var bookmarksRouter = require('./routes/bookmarks');
var preferencesRouter = require('./routes/preferences');
var profileRouter = require('./routes/profile');
var sitemapRouter = require('./routes/sitemap');

var app = express();

// View engine
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https://starlingtek-samuel-sermons.nyc3.cdn.digitaloceanspaces.com"],
      frameSrc: ["'self'", "https://starlingtek-samuel-sermons.nyc3.cdn.digitaloceanspaces.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'wasm-unsafe-eval'", "https://cdn.jsdelivr.net"],
      workerSrc: ["'self'", "blob:", "https://cdn.jsdelivr.net"],
      connectSrc: ["'self'", "data:", "blob:", "https://cdn.jsdelivr.net", "https://tessdata.projectnaptha.com", "https://starlingtek-samuel-sermons.nyc3.cdn.digitaloceanspaces.com"],
    },
  },
}));

// Rate limiting (relaxed in development)
var isDev = process.env.NODE_ENV !== 'production';
var limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 1000 : 200,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Stricter limit on auth routes
var authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 200 : 20,
  message: 'Too many attempts. Please try again later.',
});

// Body parsing
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Sessions
app.use(session({
  store: new PgSession({
    pool: pool,
    tableName: 'session',
    createTableIfMissing: false,
  }),
  secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    sameSite: 'lax',
  },
}));

// Load current user into all templates
app.use(loadUser);

// Force password change before accessing any other route
app.use(requirePasswordChange);

// Routes
app.use('/', indexRouter);
app.use('/auth', authLimiter, authRouter);
app.use('/admin', adminRouter);
app.use('/sermons', sermonsRouter);
app.use('/about', aboutRouter);
app.use('/feed', feedRouter);
app.use('/bookmarks', bookmarksRouter);
app.use('/api/preferences', preferencesRouter);
app.use('/profile', profileRouter);
app.use('/', sitemapRouter);

// 404 handler
app.use(function (req, res, next) {
  res.status(404).render('404', { pageTitle: 'Page Not Found' });
});

// Error handler
app.use(function (err, req, res, next) {
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
