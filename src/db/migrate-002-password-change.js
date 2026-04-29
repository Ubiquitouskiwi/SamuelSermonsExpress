#!/usr/bin/env node
/**
 * Migration 002: Add must_change_password and last_login_at to users table.
 * Usage: node src/db/migrate-002-password-change.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const pool = require('./pool');

const migration = `
  ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
`;

async function run() {
  console.log('Running migration 002...');
  try {
    await pool.query(migration);
    console.log('Migration 002 complete.');
  } catch (err) {
    console.error('Migration 002 failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
