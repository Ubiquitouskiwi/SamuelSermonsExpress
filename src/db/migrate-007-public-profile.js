#!/usr/bin/env node
/**
 * Migration 007: Public profile fields — nickname, bio, avatar.
 * Usage: node src/db/migrate-007-public-profile.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const pool = require('./pool');

const migration = `
  ALTER TABLE users ADD COLUMN IF NOT EXISTS nickname VARCHAR(50);
  ALTER TABLE users ADD COLUMN IF NOT EXISTS bio VARCHAR(500);
  ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar VARCHAR(50) NOT NULL DEFAULT 'book';
`;

async function run() {
  console.log('Running migration 007...');
  try {
    await pool.query(migration);
    console.log('Migration 007 complete.');
  } catch (err) {
    console.error('Migration 007 failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
