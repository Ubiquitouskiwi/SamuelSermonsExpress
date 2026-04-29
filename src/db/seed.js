#!/usr/bin/env node
/**
 * Seed script: imports existing hardcoded sermon data into PostgreSQL
 * and creates the initial admin account.
 *
 * Usage: node src/db/seed.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const pool = require('./pool');
const bcrypt = require('bcryptjs');
const orderedSermonData = require('../utils/orderedSermonData');
const unorderedSermonData = require('../utils/unorderedSermonData');

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // --- Seed admin user ---
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@samuelsermons.com';
    const adminPass = process.env.ADMIN_PASSWORD || 'changeme123';
    const hash = await bcrypt.hash(adminPass, 12);

    await client.query(
      `INSERT INTO users (email, display_name, password_hash, role)
       VALUES ($1, $2, $3, 'admin')
       ON CONFLICT (email) DO NOTHING`,
      [adminEmail, 'Admin', hash]
    );
    console.log(`Admin user seeded: ${adminEmail}`);

    // --- Seed ordered sermons ---
    for (const s of orderedSermonData) {
      await client.query(
        `INSERT INTO sermons (title, sermon_type, collection, pdf_path, stage)
         VALUES ($1, $2, 'ordered', $3, 'processed')
         ON CONFLICT DO NOTHING`,
        [s.title, s.sermonType, s.imageLink]
      );
    }
    console.log(`Seeded ${orderedSermonData.length} ordered sermons.`);

    // --- Seed unordered sermons ---
    for (const s of unorderedSermonData) {
      await client.query(
        `INSERT INTO sermons (title, sermon_type, collection, pdf_path, stage)
         VALUES ($1, $2, 'unordered', $3, 'processed')
         ON CONFLICT DO NOTHING`,
        [s.title, s.sermonType, s.imageLink]
      );
    }
    console.log(`Seeded ${unorderedSermonData.length} unordered sermons.`);

    await client.query('COMMIT');
    console.log('Seed complete.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
