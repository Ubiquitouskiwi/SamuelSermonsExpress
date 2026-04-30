/**
 * Points system — award points and compute badges.
 */
const pool = require('../db/pool');

// Point values
const POINTS = {
  sermon_uploaded:          50,
  sermon_stage_moved:       15,
  transcription_started:    10,
  transcription_complete:   100,
  transcription_words:      1,   // per word (delta)
  bonus_long_sermon:        50,  // over 2000 words
  bonus_first_upload:       25,
  bonus_first_transcription: 25,
  review_complete:          75,
  review_comment:           5,
  bonus_first_review:       25,
};

// Badge tiers (ordered by threshold)
const BADGES = [
  { key: 'first_steps',    label: 'First Steps',      icon: '🌱', threshold: 1,     desc: 'Completed your first action' },
  { key: 'contributor',    label: 'Contributor',       icon: '⭐', threshold: 100,   desc: 'Earned 100 points' },
  { key: 'dedicated',      label: 'Dedicated',         icon: '🔥', threshold: 500,   desc: 'Earned 500 points' },
  { key: 'devoted',        label: 'Devoted',           icon: '💎', threshold: 1000,  desc: 'Earned 1,000 points' },
  { key: 'pillar',         label: 'Pillar',            icon: '🏛️', threshold: 2500,  desc: 'Earned 2,500 points' },
  { key: 'legacy_keeper',  label: 'Legacy Keeper',     icon: '📜', threshold: 5000,  desc: 'Earned 5,000 points' },
  { key: 'samuels_scribe', label: "Samuel's Scribe",   icon: '✝️', threshold: 10000, desc: 'Earned 10,000 points — the highest honor' },
];

/**
 * Award points to a user.
 */
async function awardPoints(userId, points, reason, description, sermonId) {
  if (!userId || points <= 0) return;
  try {
    await pool.query(
      'INSERT INTO user_points (user_id, points, reason, description, sermon_id) VALUES ($1, $2, $3, $4, $5)',
      [userId, points, reason, description || null, sermonId || null]
    );
    await pool.query(
      'UPDATE users SET total_points = total_points + $1 WHERE id = $2',
      [points, userId]
    );
  } catch (err) {
    console.error('Award points error:', err.message);
  }
}

/**
 * Check and award first-time bonuses.
 */
async function checkFirstTimeBonus(userId, reason) {
  try {
    const result = await pool.query(
      'SELECT COUNT(*) FROM user_points WHERE user_id = $1 AND reason = $2',
      [userId, reason]
    );
    return parseInt(result.rows[0].count, 10) === 0;
  } catch (err) {
    return false;
  }
}

/**
 * Award points for uploading a sermon.
 */
async function awardUpload(userId, sermonTitle, sermonId) {
  const isFirst = await checkFirstTimeBonus(userId, 'sermon_uploaded');
  await awardPoints(userId, POINTS.sermon_uploaded, 'sermon_uploaded', 'Uploaded: ' + sermonTitle, sermonId);
  if (isFirst) {
    await awardPoints(userId, POINTS.bonus_first_upload, 'bonus_first_upload', 'First sermon upload!', sermonId);
  }
}

/**
 * Award points for moving a sermon through the pipeline.
 */
async function awardStageMove(userId, sermonTitle, newStage, sermonId) {
  await awardPoints(userId, POINTS.sermon_stage_moved, 'sermon_stage_moved', 'Moved to ' + newStage + ': ' + sermonTitle, sermonId);
}

/**
 * Award points for starting a transcription.
 */
async function awardTranscriptionStarted(userId, sermonTitle, sermonId) {
  // Only award once per sermon
  const result = await pool.query(
    'SELECT COUNT(*) FROM user_points WHERE user_id = $1 AND reason = $2 AND sermon_id = $3',
    [userId, 'transcription_started', sermonId]
  );
  if (parseInt(result.rows[0].count, 10) === 0) {
    const isFirst = await checkFirstTimeBonus(userId, 'transcription_started');
    await awardPoints(userId, POINTS.transcription_started, 'transcription_started', 'Started: ' + sermonTitle, sermonId);
    if (isFirst) {
      await awardPoints(userId, POINTS.bonus_first_transcription, 'bonus_first_transcription', 'First transcription started!', sermonId);
    }
  }
}

/**
 * Award points for completing a transcription.
 */
async function awardTranscriptionComplete(userId, sermonTitle, wordCount, sermonId) {
  await awardPoints(userId, POINTS.transcription_complete, 'transcription_complete', 'Completed: ' + sermonTitle, sermonId);
  if (wordCount > 2000) {
    await awardPoints(userId, POINTS.bonus_long_sermon, 'bonus_long_sermon', 'Long sermon bonus (' + wordCount + ' words): ' + sermonTitle, sermonId);
  }
}

/**
 * Get badges earned by a user based on their total points.
 */
function getBadges(totalPoints) {
  return BADGES.filter(function (b) { return totalPoints >= b.threshold; });
}

/**
 * Get the next badge a user is working toward.
 */
function getNextBadge(totalPoints) {
  for (var i = 0; i < BADGES.length; i++) {
    if (totalPoints < BADGES[i].threshold) return BADGES[i];
  }
  return null; // All badges earned
}

/**
 * Get a user's point history.
 */
async function getPointHistory(userId, limit) {
  const result = await pool.query(
    'SELECT points, reason, description, created_at FROM user_points WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
    [userId, limit || 20]
  );
  return result.rows;
}

module.exports = {
  POINTS, BADGES,
  awardPoints, awardUpload, awardStageMove,
  awardTranscriptionStarted, awardTranscriptionComplete,
  getBadges, getNextBadge, getPointHistory,
  getAchievements: require('./achievements').getAchievements,
};

