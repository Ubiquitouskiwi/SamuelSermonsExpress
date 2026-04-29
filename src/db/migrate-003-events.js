#!/usr/bin/env node
/**
 * Migration 003: Create sermon_events table for activity tracking and RSS feed.
 * Usage: node src/db/migrate-003-events.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const pool = require('./pool');

const migration = `
  CREATE TABLE IF NOT EXISTS sermon_events (
    id          SERIAL PRIMARY KEY,
    sermon_id   INTEGER REFERENCES sermons(id) ON DELETE CASCADE,
    event_type  VARCHAR(50) NOT NULL,
    title       VARCHAR(500) NOT NULL,
    description TEXT,
    created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_sermon_events_created ON sermon_events (created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_sermon_events_type ON sermon_events (event_type);
`;

async function run() {
  console.log('Running migration 003...');
  try {
    await pool.query(migration);
    console.log('Migration 003 complete.');
  } catch (err) {
    console.error('Migration 003 failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
