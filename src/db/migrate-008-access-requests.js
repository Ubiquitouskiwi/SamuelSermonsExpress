#!/usr/bin/env node
/**
 * Migration 008: Access requests table.
 * Usage: node src/db/migrate-008-access-requests.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const pool = require('./pool');

const migration = `
  CREATE TABLE IF NOT EXISTS access_requests (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    email       VARCHAR(255) NOT NULL,
    role        VARCHAR(50) NOT NULL,
    message     TEXT,
    status      VARCHAR(20) NOT NULL DEFAULT 'pending',
    reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ
  );
  CREATE INDEX IF NOT EXISTS idx_access_requests_status ON access_requests (status);
`;

async function run() {
  console.log('Running migration 008...');
  try {
    await pool.query(migration);
    console.log('Migration 008 complete.');
  } catch (err) {
    console.error('Migration 008 failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
