#!/usr/bin/env node
/**
 * Migration 009: Issues/bug reports table.
 * Usage: node src/db/migrate-009-issues.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const pool = require('./pool');

const migration = `
  CREATE TABLE IF NOT EXISTS issues (
    id          SERIAL PRIMARY KEY,
    title       VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    category    VARCHAR(50) NOT NULL DEFAULT 'bug',
    priority    VARCHAR(20) NOT NULL DEFAULT 'medium',
    status      VARCHAR(20) NOT NULL DEFAULT 'open',
    created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
    assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_issues_status ON issues (status);
  CREATE INDEX IF NOT EXISTS idx_issues_created_by ON issues (created_by);
`;

async function run() {
  console.log('Running migration 009...');
  try {
    await pool.query(migration);
    console.log('Migration 009 complete.');
  } catch (err) {
    console.error('Migration 009 failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
