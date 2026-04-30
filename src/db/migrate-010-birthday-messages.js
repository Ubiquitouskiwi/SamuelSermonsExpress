#!/usr/bin/env node
/**
 * Migration 010: Birthday messages table.
 * Usage: node src/db/migrate-010-birthday-messages.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const pool = require('./pool');

const migration = `
  CREATE TABLE IF NOT EXISTS birthday_messages (
    id          SERIAL PRIMARY KEY,
    author_name VARCHAR(100),
    message     TEXT NOT NULL,
    year        INTEGER NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
`;

async function run() {
  console.log('Running migration 010...');
  try {
    await pool.query(migration);
    console.log('Migration 010 complete.');
  } catch (err) {
    console.error('Migration 010 failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
