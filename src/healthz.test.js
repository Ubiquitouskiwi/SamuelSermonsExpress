const request = require('supertest');

// The session store and DB pool are not needed for /healthz; stub them so the
// test runs without Postgres.
jest.mock('./db/pool', () => ({ query: jest.fn(), on: jest.fn(), end: jest.fn() }));
jest.mock('connect-pg-simple', () => (session) =>
  class extends session.MemoryStore {}
);

const app = require('./app');

test('GET /healthz answers 200 without touching the database', async () => {
  const pool = require('./db/pool');
  const res = await request(app).get('/healthz');
  expect(res.status).toBe(200);
  expect(res.body).toEqual({ ok: true });
  expect(res.headers['cache-control']).toBe('no-store');
  expect(pool.query).not.toHaveBeenCalled();
});
