/**
 * Integration tests for the admin blocklist sub-router.
 * Uses an Express app with a fake render so we can assert on the locals
 * passed to the view, and mocks the pg pool to control DB outcomes.
 */

// Mock dependencies before requiring the router.
jest.mock('../../db/pool', () => ({ query: jest.fn() }));
// Bypass requireRole — the router-level admin gate is verified separately
// in the auth middleware tests; here we want to focus on handler logic.
jest.mock('../../middleware/auth', () => ({
  requireRole: () => (req, res, next) => next(),
}));

const express = require('express');
const request = require('supertest');
const pool = require('../../db/pool');
const blocklistRouter = require('./blocklist');

function buildApp() {
  const app = express();
  app.use(express.urlencoded({ extended: false }));

  // Stub session and render so we can assert directly on the locals.
  app.use((req, res, next) => {
    req.session = req.session || { userId: 42 };
    res.render = (view, locals) => {
      res.status(200).json({ __view: view, locals, session: req.session });
    };
    next();
  });

  app.use('/admin/blocklist', blocklistRouter);
  return app;
}

beforeEach(() => {
  pool.query.mockReset();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  console.error.mockRestore();
});

describe('GET /admin/blocklist', () => {
  test('renders the page with entries ordered DESC and null prefill/error/formValues', async () => {
    const rows = [
      { id: 2, block_type: 'email', pattern: 'b@x.com', is_regex: false, reason: null,
        created_at: new Date(), created_by_name: 'Alice' },
      { id: 1, block_type: 'name', pattern: 'A', is_regex: false, reason: 'r',
        created_at: new Date(), created_by_name: null },
    ];
    pool.query.mockResolvedValueOnce({ rows });

    const res = await request(buildApp()).get('/admin/blocklist');

    expect(res.status).toBe(200);
    expect(res.body.__view).toBe('admin/blocklist');
    expect(res.body.locals.entries).toEqual(
      rows.map((r) => ({ ...r, created_at: r.created_at.toISOString() }))
    );
    expect(res.body.locals.prefill).toEqual({ type: null, email: null, name: null });
    expect(res.body.locals.error).toBeNull();
    expect(res.body.locals.formValues).toBeNull();
    expect(res.body.locals.flash).toBeNull();
    expect(pool.query.mock.calls[0][0]).toMatch(/ORDER BY b\.created_at DESC/);
    expect(pool.query.mock.calls[0][0]).toMatch(/LEFT JOIN users u ON b\.created_by = u\.id/);
    // hit_count and last_hit_at must be selected so the view can render them.
    expect(pool.query.mock.calls[0][0]).toMatch(/b\.hit_count/);
    expect(pool.query.mock.calls[0][0]).toMatch(/b\.last_hit_at/);
  });

  test('reads optional pre-fill query parameters', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(buildApp()).get(
      '/admin/blocklist?prefill_type=email&prefill_email=spammer%40x.com&prefill_name=Bob'
    );
    expect(res.body.locals.prefill).toEqual({
      type: 'email',
      email: 'spammer@x.com',
      name: 'Bob',
    });
  });

  test('reads and clears req.session.flash so the message is one-shot', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const app = express();
    app.use(express.urlencoded({ extended: false }));
    app.use((req, res, next) => {
      req.session = { userId: 42, flash: { type: 'success', message: 'hi' } };
      res.render = (view, locals) => res.json({ locals, session: req.session });
      next();
    });
    app.use('/admin/blocklist', blocklistRouter);

    const res = await request(app).get('/admin/blocklist');
    expect(res.body.locals.flash).toEqual({ type: 'success', message: 'hi' });
    // Flash should be cleared from the session after read.
    expect(res.body.session.flash).toBeUndefined();
  });

  test('renders with empty entries list when the DB query fails', async () => {
    pool.query.mockRejectedValueOnce(new Error('boom'));
    const res = await request(buildApp()).get('/admin/blocklist');
    expect(res.status).toBe(200);
    expect(res.body.locals.entries).toEqual([]);
    expect(console.error).toHaveBeenCalledWith('Blocklist list error:', expect.any(Error));
  });
});

describe('POST /admin/blocklist/add', () => {
  test('rejects an invalid block_type and re-renders with formValues preserved', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] }); // for the re-render's loadEntries
    const res = await request(buildApp())
      .post('/admin/blocklist/add')
      .type('form')
      .send({ block_type: 'something', pattern: 'p', reason: '' });

    expect(res.status).toBe(200);
    expect(res.body.locals.error).toBe("Block type must be 'email' or 'name'.");
    expect(res.body.locals.formValues).toEqual({
      block_type: 'something',
      pattern: 'p',
      is_regex: false,
      reason: '',
    });
    // Insert should NOT have been called.
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  test('rejects an empty pattern after trim', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(buildApp())
      .post('/admin/blocklist/add')
      .type('form')
      .send({ block_type: 'email', pattern: '   ', reason: '' });

    expect(res.body.locals.error).toBe(
      'Pattern is required and must be at most 500 characters.'
    );
    expect(res.body.locals.formValues.pattern).toBe('');
  });

  test('rejects a pattern longer than 500 characters', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const longPattern = 'a'.repeat(501);
    const res = await request(buildApp())
      .post('/admin/blocklist/add')
      .type('form')
      .send({ block_type: 'email', pattern: longPattern });

    expect(res.body.locals.error).toBe(
      'Pattern is required and must be at most 500 characters.'
    );
  });

  test('rejects a reason longer than 500 characters', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const longReason = 'r'.repeat(501);
    const res = await request(buildApp())
      .post('/admin/blocklist/add')
      .type('form')
      .send({ block_type: 'email', pattern: 'ok@x.com', reason: longReason });

    expect(res.body.locals.error).toBe('Reason must be at most 500 characters.');
  });

  test('rejects an uncompilable regex pattern', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(buildApp())
      .post('/admin/blocklist/add')
      .type('form')
      .send({ block_type: 'email', pattern: '[unterminated', is_regex: 'on' });

    expect(res.body.locals.error).toMatch(/^Invalid regex: .+\.$/);
    expect(res.body.locals.formValues.is_regex).toBe(true);
  });

  test('inserts a valid literal entry and redirects with a success flash', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 1, rows: [] }); // INSERT
    const res = await request(buildApp())
      .post('/admin/blocklist/add')
      .type('form')
      .send({ block_type: 'email', pattern: 'spammer@x.com', reason: 'spam' });

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/admin/blocklist');

    // Verify the INSERT was called with the expected parameters.
    const insertCall = pool.query.mock.calls[0];
    expect(insertCall[0]).toMatch(/INSERT INTO request_blocklist/);
    expect(insertCall[1]).toEqual([
      'email',
      'spammer@x.com',
      false,
      'spam',
      42, // session.userId
    ]);
  });

  test('inserts a valid regex entry with is_regex=true', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 1, rows: [] });
    await request(buildApp())
      .post('/admin/blocklist/add')
      .type('form')
      .send({ block_type: 'email', pattern: '^.*@spam\\.tld$', is_regex: 'on' });

    expect(pool.query.mock.calls[0][1][2]).toBe(true);
  });

  test('passes null for an empty trimmed reason', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 1, rows: [] });
    await request(buildApp())
      .post('/admin/blocklist/add')
      .type('form')
      .send({ block_type: 'email', pattern: 'a@b.com', reason: '   ' });

    expect(pool.query.mock.calls[0][1][3]).toBeNull();
  });

  test('on duplicate (Postgres 23505) re-renders with the duplicate error', async () => {
    const dupErr = Object.assign(new Error('dup'), { code: '23505' });
    pool.query
      .mockRejectedValueOnce(dupErr) // INSERT fails
      .mockResolvedValueOnce({ rows: [] }); // loadEntries for re-render

    const res = await request(buildApp())
      .post('/admin/blocklist/add')
      .type('form')
      .send({ block_type: 'email', pattern: 'dup@x.com' });

    expect(res.status).toBe(200);
    expect(res.body.locals.error).toBe('A block with this pattern already exists.');
    expect(res.body.locals.formValues.pattern).toBe('dup@x.com');
  });

  test('on a non-23505 INSERT failure re-renders with a generic error', async () => {
    pool.query
      .mockRejectedValueOnce(new Error('connection refused'))
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(buildApp())
      .post('/admin/blocklist/add')
      .type('form')
      .send({ block_type: 'email', pattern: 'a@b.com' });

    expect(res.body.locals.error).toBe('Could not add block. Please try again.');
    expect(console.error).toHaveBeenCalledWith('Blocklist add error:', expect.any(Error));
  });

  test('renders empty entries list when re-render loadEntries also fails', async () => {
    const dupErr = Object.assign(new Error('dup'), { code: '23505' });
    pool.query
      .mockRejectedValueOnce(dupErr) // INSERT
      .mockRejectedValueOnce(new Error('select fail')); // loadEntries during re-render

    const res = await request(buildApp())
      .post('/admin/blocklist/add')
      .type('form')
      .send({ block_type: 'email', pattern: 'dup@x.com' });

    expect(res.body.locals.entries).toEqual([]);
    expect(res.body.locals.error).toBe('A block with this pattern already exists.');
    expect(console.error).toHaveBeenCalledWith('Blocklist list error:', expect.any(Error));
  });

  test('coerces is_regex from "true" string as well as "on"', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 1, rows: [] });
    await request(buildApp())
      .post('/admin/blocklist/add')
      .type('form')
      .send({ block_type: 'email', pattern: '^x$', is_regex: 'true' });

    expect(pool.query.mock.calls[0][1][2]).toBe(true);
  });

  test('treats non-string pattern body field as empty', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    // Sending JSON with an object value forces pattern to be a non-string.
    const jsonApp = express();
    jsonApp.use(express.json());
    jsonApp.use((req, res, next) => {
      req.session = { userId: 42 };
      res.render = (view, locals) =>
        res.status(200).json({ __view: view, locals });
      next();
    });
    jsonApp.use('/admin/blocklist', blocklistRouter);

    const res = await request(jsonApp)
      .post('/admin/blocklist/add')
      .send({ block_type: 'email', pattern: { not: 'a string' }, reason: 42 });

    expect(res.body.locals.error).toBe(
      'Pattern is required and must be at most 500 characters.'
    );
    // pattern echoed back as empty string, reason coerced from non-string to ''.
    expect(res.body.locals.formValues).toEqual({
      block_type: 'email',
      pattern: '',
      is_regex: false,
      reason: '',
    });
  });

  test('sets a session flash with the inserted pattern on success', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 1, rows: [] });

    // Capture session via a custom app so we can read it after the request.
    const sessions = [];
    const app = express();
    app.use(express.urlencoded({ extended: false }));
    app.use((req, res, next) => {
      req.session = { userId: 42 };
      sessions.push(req.session);
      next();
    });
    app.use('/admin/blocklist', blocklistRouter);

    await request(app)
      .post('/admin/blocklist/add')
      .type('form')
      .send({ block_type: 'email', pattern: 'new@x.com' });

    expect(sessions[0].flash).toEqual({
      type: 'success',
      message: 'Added block "new@x.com".',
    });
  });
});

describe('POST /admin/blocklist/:id/remove', () => {
  test('deletes the entry and redirects with a success flash echoing the pattern', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ pattern: 'gone@x.com' }] });

    const sessions = [];
    const app = express();
    app.use(express.urlencoded({ extended: false }));
    app.use((req, res, next) => {
      req.session = { userId: 42 };
      sessions.push(req.session);
      next();
    });
    app.use('/admin/blocklist', blocklistRouter);

    const res = await request(app).post('/admin/blocklist/5/remove');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/admin/blocklist');
    expect(sessions[0].flash).toEqual({
      type: 'success',
      message: 'Removed block "gone@x.com".',
    });
    expect(pool.query.mock.calls[0][0]).toMatch(/DELETE FROM request_blocklist/);
    expect(pool.query.mock.calls[0][1]).toEqual([5]);
  });

  test('rejects a non-integer id with a not-found flash', async () => {
    const sessions = [];
    const app = express();
    app.use(express.urlencoded({ extended: false }));
    app.use((req, res, next) => {
      req.session = { userId: 42 };
      sessions.push(req.session);
      next();
    });
    app.use('/admin/blocklist', blocklistRouter);

    const res = await request(app).post('/admin/blocklist/abc/remove');
    expect(res.status).toBe(302);
    expect(sessions[0].flash).toEqual({
      type: 'error',
      message: 'That block could not be found.',
    });
    // No DELETE should be issued.
    expect(pool.query).not.toHaveBeenCalled();
  });

  test('rejects ids with trailing junk like "5abc"', async () => {
    const sessions = [];
    const app = express();
    app.use(express.urlencoded({ extended: false }));
    app.use((req, res, next) => {
      req.session = { userId: 42 };
      sessions.push(req.session);
      next();
    });
    app.use('/admin/blocklist', blocklistRouter);

    await request(app).post('/admin/blocklist/5abc/remove');
    expect(sessions[0].flash.type).toBe('error');
    expect(pool.query).not.toHaveBeenCalled();
  });

  test('flashes a not-found error when no row is deleted', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 0, rows: [] });

    const sessions = [];
    const app = express();
    app.use(express.urlencoded({ extended: false }));
    app.use((req, res, next) => {
      req.session = { userId: 42 };
      sessions.push(req.session);
      next();
    });
    app.use('/admin/blocklist', blocklistRouter);

    await request(app).post('/admin/blocklist/9999/remove');
    expect(sessions[0].flash).toEqual({
      type: 'error',
      message: 'That block could not be found.',
    });
  });

  test('flashes a generic error when DELETE itself throws', async () => {
    pool.query.mockRejectedValueOnce(new Error('boom'));

    const sessions = [];
    const app = express();
    app.use(express.urlencoded({ extended: false }));
    app.use((req, res, next) => {
      req.session = { userId: 42 };
      sessions.push(req.session);
      next();
    });
    app.use('/admin/blocklist', blocklistRouter);

    const res = await request(app).post('/admin/blocklist/5/remove');
    expect(res.status).toBe(302);
    expect(sessions[0].flash).toEqual({
      type: 'error',
      message: 'Could not remove block. Please try again.',
    });
    expect(console.error).toHaveBeenCalledWith('Blocklist remove error:', expect.any(Error));
  });
});
