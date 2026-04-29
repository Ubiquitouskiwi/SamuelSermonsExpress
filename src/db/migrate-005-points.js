#!/usr/bin/env node
/**
 * Migration 005: Points system — user_points event log + total_points cache on users.
 * Usage: node src/db/migrate-005-points.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const pool = require('./pool');

const migration = `
  ALTER TABLE users ADD COLUMN IF NOT EXISTS total_points INTEGER NOT NULL DEFAULT 0;

  CREATE TABLE IF NOT EXISTS user_points (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    points      INTEGER NOT NULL,
    reason      VARCHAR(100) NOT NULL,
    description VARCHAR(500),
    sermon_id   INTEGER REFERENCES sermons(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_user_points_user ON user_points (user_id);
  CREATE INDEX IF NOT EXISTS idx_user_points_created ON user_points (created_at DESC);
`;

async function run() {
  console.log('Running migration 005...');
  try {
    await pool.query(migration);
    console.log('Migration 005 complete.');
  } catch (err) {
    console.error('Migration 005 failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
