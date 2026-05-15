/**
 * Integration tests for the public contact (access request) route, with
 * particular focus on silent rejection by the blocklist.
 */

jest.mock('../db/pool', () => ({ query: jest.fn() }));
jest.mock('../utils/blocklist', () => ({
  findMatchingBlock: jest.fn(),
  validateRegex: jest.fn(),
}));
jest.mock('../utils/events', () => ({ logEvent: jest.fn() }));

const express = require('express');
const request = require('supertest');
const pool = require('../db/pool');
const { findMatchingBlock } = require('../utils/blocklist');
const { logEvent } = require('../utils/events');
const contactRouter = require('./contact');

function buildApp() {
  const app = express();
  app.use(express.urlencoded({ extended: false }));
  app.use((req, res, next) => {
    res.render = (view, locals) => res.status(200).json({ view, locals });
    next();
  });
  app.use('/contact', contactRouter);
  return app;
}

const validBody = {
  name: 'Real Person',
  email: 'real@example.com',
  role: 'transcriber',
  message: 'Hi there',
};

beforeEach(() => {
  pool.query.mockReset();
  findMatchingBlock.mockReset();
  logEvent.mockReset();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  console.error.mockRestore();
});

describe('GET /contact', () => {
  test('renders the contact page with empty error/success', async () => {
    const res = await request(buildApp()).get('/contact');
    expect(res.status).toBe(200);
    expect(res.body.view).toBe('contact');
    expect(res.body.locals).toEqual({
      error: null,
      success: null,
      pageTitle: 'Join the Team',
    });
  });
});

describe('POST /contact', () => {
  test('renders a validation error when fields are missing', async () => {
    const res = await request(buildApp())
      .post('/contact')
      .type('form')
      .send({ name: '', email: 'not-an-email', role: 'wrong' });

    expect(res.status).toBe(200);
    expect(res.body.locals.error).toBeTruthy();
    expect(res.body.locals.success).toBeNull();
    // No DB or blocklist calls should happen on validation failure.
    expect(findMatchingBlock).not.toHaveBeenCalled();
    expect(pool.query).not.toHaveBeenCalled();
  });

  test('on a clean miss, inserts and logs the access_request event', async () => {
    findMatchingBlock.mockResolvedValue(null);
    pool.query.mockResolvedValueOnce({ rowCount: 1, rows: [] }); // INSERT

    const res = await request(buildApp())
      .post('/contact')
      .type('form')
      .send(validBody);

    expect(res.status).toBe(200);
    expect(res.body.locals.success).toMatch(/Thanks!/);
    expect(res.body.locals.error).toBeNull();

    expect(findMatchingBlock).toHaveBeenCalledWith({
      name: 'Real Person',
      email: 'real@example.com',
    });
    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query.mock.calls[0][0]).toMatch(/INSERT INTO access_requests/);
    expect(pool.query.mock.calls[0][1]).toEqual([
      'Real Person',
      'real@example.com',
      'transcriber',
      'Hi there',
    ]);

    expect(logEvent).toHaveBeenCalledTimes(1);
    expect(logEvent).toHaveBeenCalledWith(
      'access_request',
      expect.stringContaining('Real Person'),
      expect.stringContaining('real@example.com'),
      null,
      null
    );
  });

  test('passes null for an empty optional message', async () => {
    findMatchingBlock.mockResolvedValue(null);
    pool.query.mockResolvedValueOnce({ rowCount: 1, rows: [] });

    await request(buildApp())
      .post('/contact')
      .type('form')
      .send({ ...validBody, message: '' });

    expect(pool.query.mock.calls[0][1][3]).toBeNull();
  });

  test('on a blocklist match, renders the same success page and skips insert + access_request event', async () => {
    findMatchingBlock.mockResolvedValue(42);

    const res = await request(buildApp())
      .post('/contact')
      .type('form')
      .send(validBody);

    expect(res.status).toBe(200);
    expect(res.body.locals).toEqual({
      error: null,
      success: "Thanks! Your request has been sent. We'll be in touch soon.",
      pageTitle: 'Join the Team',
    });

    // No INSERT into access_requests.
    expect(pool.query).not.toHaveBeenCalled();

    // logEvent called exactly once, for the blocked event only.
    expect(logEvent).toHaveBeenCalledTimes(1);
    expect(logEvent).toHaveBeenCalledWith(
      'access_request_blocked',
      'Blocked access request from Real Person',
      'Email: real@example.com; matched blocklist entry 42',
      null,
      null
    );
  });

  test('blocked render is byte-identical to accepted render for success/error/pageTitle', async () => {
    findMatchingBlock.mockResolvedValueOnce(99); // blocked
    const blocked = await request(buildApp())
      .post('/contact')
      .type('form')
      .send(validBody);

    findMatchingBlock.mockResolvedValueOnce(null); // accepted
    pool.query.mockResolvedValueOnce({ rowCount: 1, rows: [] });
    const accepted = await request(buildApp())
      .post('/contact')
      .type('form')
      .send(validBody);

    expect(blocked.body.locals).toEqual(accepted.body.locals);
    expect(blocked.body.view).toBe(accepted.body.view);
  });

  test('on a blocklist DB error, renders the generic error page (not the success page)', async () => {
    findMatchingBlock.mockRejectedValue(new Error('connection refused'));

    const res = await request(buildApp())
      .post('/contact')
      .type('form')
      .send(validBody);

    expect(res.status).toBe(200);
    expect(res.body.locals.error).toMatch(/Something went wrong/);
    expect(res.body.locals.success).toBeNull();
    expect(pool.query).not.toHaveBeenCalled();
    expect(logEvent).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalled();
  });

  test('on an INSERT failure during the accepted path, renders the generic error', async () => {
    findMatchingBlock.mockResolvedValue(null);
    pool.query.mockRejectedValueOnce(new Error('boom'));

    const res = await request(buildApp())
      .post('/contact')
      .type('form')
      .send(validBody);

    expect(res.body.locals.error).toMatch(/Something went wrong/);
    expect(res.body.locals.success).toBeNull();
  });
});
