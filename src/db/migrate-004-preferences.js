#!/usr/bin/env node
/**
 * Migration 004: Add preferences JSONB column to users table.
 * Usage: node src/db/migrate-004-preferences.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const pool = require('./pool');

const migration = `
  ALTER TABLE users ADD COLUMN IF NOT EXISTS preferences JSONB NOT NULL DEFAULT '{}';
`;

async function run() {
  console.log('Running migration 004...');
  try {
    await pool.query(migration);
    console.log('Migration 004 complete.');
  } catch (err) {
    console.error('Migration 004 failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
