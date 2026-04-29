/**
 * PostgreSQL connection pool.
 * All database access goes through this single pool instance.
 */
const { Pool } = require('pg');

// DigitalOcean managed databases use self-signed certs.
// Strip sslmode from the URL and configure SSL separately
// so pg doesn't try to verify the certificate chain.
let connectionString = process.env.DATABASE_URL || '';
const useSSL = connectionString.includes('sslmode=');
connectionString = connectionString.replace(/[\?&]sslmode=[^&]*/g, '');
// Clean up leftover ? if sslmode was the only param
connectionString = connectionString.replace(/\?$/, '');

const pool = new Pool({
  connectionString,
  ssl: useSSL ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error:', err);
});

module.exports = pool;
