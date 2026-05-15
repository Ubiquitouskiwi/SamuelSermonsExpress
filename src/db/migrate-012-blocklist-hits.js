#!/usr/bin/env node
/**
 * Migration 012: Track hit counts on blocklist entries.
 * Adds `hit_count` and `last_hit_at` columns so admins can see how often
 * each blocked sender is still trying to submit requests.
 *
 * Usage: node src/db/migrate-012-blocklist-hits.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const pool = require('./pool');

const migration = `
  ALTER TABLE request_blocklist
    ADD COLUMN IF NOT EXISTS hit_count   INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_hit_at TIMESTAMPTZ;
`;

async function run() {
  console.log('Running migration 012...');
  try {
    await pool.query(migration);
    console.log('Migration 012 complete.');
  } catch (err) {
    console.error('Migration 012 failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
