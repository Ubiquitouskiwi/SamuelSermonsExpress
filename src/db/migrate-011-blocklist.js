#!/usr/bin/env node
/**
 * Migration 011: Blocklist for access requests.
 * Usage: node src/db/migrate-011-blocklist.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const pool = require('./pool');

const migration = `
  CREATE TABLE IF NOT EXISTS request_blocklist (
    id          SERIAL PRIMARY KEY,
    block_type  VARCHAR(20) NOT NULL,
    pattern     VARCHAR(500) NOT NULL,
    is_regex    BOOLEAN NOT NULL DEFAULT false,
    reason      VARCHAR(500),
    created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(block_type, pattern)
  );
  CREATE INDEX IF NOT EXISTS idx_blocklist_type ON request_blocklist (block_type);
`;

async function run() {
  console.log('Running migration 011...');
  try {
    await pool.query(migration);
    console.log('Migration 011 complete.');
  } catch (err) {
    console.error('Migration 011 failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
