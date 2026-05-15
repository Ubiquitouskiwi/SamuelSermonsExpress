/**
 * Blocklist service for access requests.
 *
 * Loads entries from the request_blocklist table and decides whether a given
 * access request matches any entry. Each entry targets a single field
 * (`email` or `name`) and may be either a literal string (case-insensitive,
 * trimmed) or a JavaScript regular expression.
 */
const pool = require('../db/pool');

/**
 * Look up a Blocklist_Entry that matches the given access request.
 * Walks every row in `request_blocklist`, picks the candidate field based on
 * `block_type`, normalizes by trimming, and compares either as a
 * case-insensitive literal or as a compiled regex.
 *
 * Regex entries that fail to compile are logged and skipped so a single
 * malformed row cannot disable the rest of the blocklist.
 *
 * @param {{ name: string, email: string }} req
 * @returns {Promise<number|null>} The matching entry's id, or null on miss.
 */
async function findMatchingBlock(req) {
  const name = req && req.name ? String(req.name) : '';
  const email = req && req.email ? String(req.email) : '';

  const result = await pool.query(
    'SELECT id, block_type, pattern, is_regex FROM request_blocklist ORDER BY id ASC'
  );

  for (var i = 0; i < result.rows.length; i++) {
    const entry = result.rows[i];
    const candidate = entry.block_type === 'email' ? email : name;
    const trimmedCandidate = candidate.trim();

    if (entry.is_regex) {
      var regex;
      try {
        regex = new RegExp(entry.pattern, 'i');
      } catch (err) {
        console.error(
          'Blocklist regex compile failed for entry ' + entry.id + ': ' + err.message
        );
        continue;
      }
      if (regex.test(trimmedCandidate)) {
        return entry.id;
      }
    } else {
      const trimmedPattern = String(entry.pattern).trim().toLowerCase();
      if (trimmedPattern === trimmedCandidate.toLowerCase()) {
        return entry.id;
      }
    }
  }

  return null;
}

/**
 * Validate that a string is a compilable JavaScript regular expression.
 * Used by the add-entry handler to reject bad regex patterns before
 * inserting them into the database.
 *
 * @param {string} pattern
 * @returns {string|null} The error message on failure, or null on success.
 */
function validateRegex(pattern) {
  try {
    new RegExp(pattern);
    return null;
  } catch (err) {
    return err.message;
  }
}

module.exports = { findMatchingBlock, validateRegex };
