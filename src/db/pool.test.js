const fs = require('fs');
const os = require('os');
const path = require('path');
const { parse } = require('pg-connection-string');
const pool = require('./pool');

const { poolConfig } = pool;
const ca = path.join(os.tmpdir(), `pool-test-ca-${process.pid}.crt`);

beforeAll(() => fs.writeFileSync(ca, 'test-ca'));
afterAll(async () => {
  fs.rmSync(ca, { force: true });
  await pool.end();
});

test('verify-full + sslrootcert URL is passed through and keeps the database name', () => {
  const url = `postgres://u:p@db.example.com:25060/samuel_sermons?sslmode=verify-full&sslrootcert=${ca}`;
  const cfg = poolConfig(url);
  expect(cfg.connectionString).toBe(url);
  expect(cfg.ssl).toBeUndefined(); // ssl comes from the URL, so the CA is used
  const parsed = parse(cfg.connectionString);
  expect(parsed.database).toBe('samuel_sermons');
  expect(parsed.ssl.ca).toBe('test-ca');
  expect(parsed.ssl.rejectUnauthorized).not.toBe(false);
});

test('legacy sslmode=require URL: sslmode removed, other params kept, TLS without verification', () => {
  const cfg = poolConfig('postgres://u:p@h:25060/samuel_sermons?sslmode=require&application_name=web');
  const parsed = parse(cfg.connectionString);
  expect(parsed.database).toBe('samuel_sermons');
  expect(parsed.application_name).toBe('web');
  expect(cfg.connectionString).not.toContain('sslmode');
  expect(cfg.ssl).toEqual({ rejectUnauthorized: false });
});

test('legacy sslmode as the only param leaves a clean URL', () => {
  const cfg = poolConfig('postgres://u:p@h:25060/samuel_sermons?sslmode=require');
  expect(parse(cfg.connectionString).database).toBe('samuel_sermons');
  expect(cfg.connectionString).not.toContain('?');
});

test('no sslmode means no TLS; empty URL is harmless', () => {
  expect(poolConfig('postgres://u:p@localhost:5432/dev').ssl).toBe(false);
  expect(poolConfig('').ssl).toBe(false);
});
