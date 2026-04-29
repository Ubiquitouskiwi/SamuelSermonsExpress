/**
 * Sermon event logger.
 * Logs activity to the sermon_events table for the RSS feed and audit trail.
 */
const pool = require('../db/pool');

/**
 * Log a sermon event.
 * @param {string} eventType - e.g. 'sermon_added', 'sermon_updated', 'stage_changed', 'transcription_started', 'transcription_complete'
 * @param {string} title - Human-readable event title
 * @param {string} [description] - Optional longer description
 * @param {number} [sermonId] - Related sermon ID
 * @param {number} [userId] - User who triggered the event
 */
async function logEvent(eventType, title, description, sermonId, userId) {
  try {
    await pool.query(
      'INSERT INTO sermon_events (event_type, title, description, sermon_id, created_by) VALUES ($1, $2, $3, $4, $5)',
      [eventType, title, description || null, sermonId || null, userId || null]
    );
  } catch (err) {
    // Don't let event logging failures break the main flow
    console.error('Event log error:', err.message);
  }
}

module.exports = { logEvent };
