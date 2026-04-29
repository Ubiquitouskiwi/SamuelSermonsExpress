#!/usr/bin/env node
/**
 * Migration 006: Peer review system for transcriptions.
 * Usage: node src/db/migrate-006-reviews.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const pool = require('./pool');

const migration = `
  CREATE TABLE IF NOT EXISTS sermon_reviews (
    id            SERIAL PRIMARY KEY,
    sermon_id     INTEGER NOT NULL REFERENCES sermons(id) ON DELETE CASCADE,
    reviewer_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status        VARCHAR(50) NOT NULL DEFAULT 'pending',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at  TIMESTAMPTZ,
    UNIQUE(sermon_id, reviewer_id, status)
  );

  CREATE TABLE IF NOT EXISTS review_comments (
    id            SERIAL PRIMARY KEY,
    review_id     INTEGER NOT NULL REFERENCES sermon_reviews(id) ON DELETE CASCADE,
    author_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    comment_text  TEXT NOT NULL,
    passage_ref   VARCHAR(500),
    is_resolved   BOOLEAN NOT NULL DEFAULT false,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_sermon_reviews_sermon ON sermon_reviews (sermon_id);
  CREATE INDEX IF NOT EXISTS idx_sermon_reviews_reviewer ON sermon_reviews (reviewer_id);
  CREATE INDEX IF NOT EXISTS idx_review_comments_review ON review_comments (review_id);
`;

async function run() {
  console.log('Running migration 006...');
  try {
    await pool.query(migration);
    console.log('Migration 006 complete.');
  } catch (err) {
    console.error('Migration 006 failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
