/**
 * PostgreSQL connection pool.
 * All database access goes through this single pool instance.
 */
const { Pool } = require('pg');

/**
 * Turn DATABASE_URL into pg Pool options.
 *
 * - With sslrootcert in the URL (what StarlingTek writes:
 *   ?sslmode=verify-full&sslrootcert=/data/<ca>.crt) the URL is used as-is,
 *   so pg verifies the server certificate against that CA.
 * - Legacy URLs (?sslmode=require, no CA) keep the old behaviour: sslmode is
 *   removed and TLS is on without certificate verification.
 *
 * Query params are edited with URL/URLSearchParams rather than a regex, so
 * removing the first param never takes the "?" with it and leaves the other
 * params glued onto the database name.
 */
function poolConfig(raw) {
  if (!raw) return { connectionString: raw, ssl: false };
  let u;
  try {
    u = new URL(raw);
  } catch {
    return { connectionString: raw, ssl: false };
  }
  if (u.searchParams.get('sslrootcert')) return { connectionString: raw };
  if (!u.searchParams.has('sslmode')) return { connectionString: raw, ssl: false };
  u.searchParams.delete('sslmode');
  return { connectionString: u.toString(), ssl: { rejectUnauthorized: false } };
}

const pool = new Pool({
  ...poolConfig(process.env.DATABASE_URL || ''),
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 15000,
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error:', err);
});

module.exports = pool;
module.exports.poolConfig = poolConfig;
