#!/usr/bin/env node
/**
 * Database migration script.
 * Creates all tables if they don't exist.
 * Safe to run multiple times (uses IF NOT EXISTS).
 *
 * Usage: node src/db/migrate.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const pool = require('./pool');

const migration = `
  -- Roles are stored as simple strings so new ones can be added without schema changes.
  -- Built-in roles: admin, transcriber, uploader, developer

  CREATE TABLE IF NOT EXISTS users (
    id            SERIAL PRIMARY KEY,
    email         VARCHAR(255) UNIQUE NOT NULL,
    display_name  VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role          VARCHAR(50)  NOT NULL DEFAULT 'transcriber',
    is_active     BOOLEAN      NOT NULL DEFAULT true,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS sermons (
    id                    SERIAL PRIMARY KEY,
    title                 VARCHAR(500)  NOT NULL,
    sermon_type           VARCHAR(50)   NOT NULL DEFAULT 'sermon',
    collection            VARCHAR(50)   NOT NULL DEFAULT 'ordered',
    pdf_path              VARCHAR(1000) NOT NULL,
    stage                 VARCHAR(50)   NOT NULL DEFAULT 'processed',
    ocr_text              TEXT,
    transcription_text    TEXT,
    transcription_status  VARCHAR(50)   NOT NULL DEFAULT 'not_started',
    transcription_notes   TEXT,
    transcribed_by        INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
  );

  -- Session table for connect-pg-simple
  CREATE TABLE IF NOT EXISTS "session" (
    "sid"    VARCHAR NOT NULL COLLATE "default",
    "sess"   JSON    NOT NULL,
    "expire" TIMESTAMP(6) NOT NULL,
    PRIMARY KEY ("sid")
  );
  CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");

  -- Permissions table: extensible role-permission mapping
  CREATE TABLE IF NOT EXISTS permissions (
    id         SERIAL PRIMARY KEY,
    role       VARCHAR(50)  NOT NULL,
    permission VARCHAR(100) NOT NULL,
    UNIQUE(role, permission)
  );

  -- Seed default permissions
  INSERT INTO permissions (role, permission) VALUES
    ('admin', 'all'),
    ('transcriber', 'sermons.view'),
    ('transcriber', 'sermons.transcribe'),
    ('uploader', 'sermons.view'),
    ('uploader', 'sermons.upload'),
    ('developer', 'sermons.view'),
    ('developer', 'admin.metrics'),
    ('developer', 'admin.logs')
  ON CONFLICT (role, permission) DO NOTHING;
`;

async function migrate() {
  console.log('Running database migration...');
  try {
    await pool.query(migration);
    console.log('Migration complete.');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
