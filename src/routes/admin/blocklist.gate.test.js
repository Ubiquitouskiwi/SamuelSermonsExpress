/**
 * Verifies the router-level admin gate using the real `requireRole`
 * middleware. Kept in a separate file so the auth module is not mocked
 * (unlike the main blocklist.test.js).
 */
jest.mock('../../db/pool', () => ({ query: jest.fn() }));

const express = require('express');
const request = require('supertest');
const blocklistRouter = require('./blocklist');

function buildApp(session) {
  const app = express();
  app.use(express.urlencoded({ extended: false }));
  app.use((req, res, next) => {
    req.session = session;
    // Preserve any status code set by upstream middleware (e.g. 403 from requireRole).
    res.render = (view, locals) => res.json({ view, locals });
    next();
  });
  app.use('/admin/blocklist', blocklistRouter);
  return app;
}

describe('admin gate (router-level requireRole)', () => {
  test('a non-admin authenticated user receives 403', async () => {
    const res = await request(
      buildApp({ userId: 5, userRole: 'transcriber' })
    ).get('/admin/blocklist');
    expect(res.status).toBe(403);
  });

  test('an unauthenticated user is redirected to /auth/login', async () => {
    const res = await request(buildApp({})).get('/admin/blocklist');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/auth/login');
  });

  test('an admin user reaches the handler', async () => {
    const pool = require('../../db/pool');
    pool.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(
      buildApp({ userId: 1, userRole: 'admin' })
    ).get('/admin/blocklist');
    expect(res.status).toBe(200);
    expect(res.body.view).toBe('admin/blocklist');
  });
});
