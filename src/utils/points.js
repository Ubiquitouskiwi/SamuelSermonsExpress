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
  getAchievements,
};

// ==========================================================================
// Dynamic Achievements — computed from actual data
// ==========================================================================

/**
 * Achievements definitions.
 * Each has a check function that returns { earned: bool, detail: string }
 */
var ACHIEVEMENT_DEFS = [
  // --- Competitive (leaderboard) ---
  {
    key: 'top_uploader',
    label: 'Top Uploader',
    icon: '📤',
    desc: 'Has the most sermon uploads',
    category: 'competitive',
    check: async function (userId) {
      var r = await pool.query(
        "SELECT user_id, COUNT(*) AS cnt FROM user_points WHERE reason = 'sermon_uploaded' GROUP BY user_id ORDER BY cnt DESC LIMIT 1"
      );
      if (r.rows.length > 0 && r.rows[0].user_id === userId) {
        return { earned: true, detail: r.rows[0].cnt + ' uploads' };
      }
      return { earned: false };
    },
  },
  {
    key: 'top_transcriber',
    label: 'Top Transcriber',
    icon: '✍️',
    desc: 'Has the most completed transcriptions',
    category: 'competitive',
    check: async function (userId) {
      var r = await pool.query(
        "SELECT user_id, COUNT(*) AS cnt FROM user_points WHERE reason = 'transcription_complete' GROUP BY user_id ORDER BY cnt DESC LIMIT 1"
      );
      if (r.rows.length > 0 && r.rows[0].user_id === userId) {
        return { earned: true, detail: r.rows[0].cnt + ' transcriptions' };
      }
      return { earned: false };
    },
  },
  {
    key: 'wordsmith',
    label: 'Wordsmith',
    icon: '📝',
    desc: 'Has transcribed the most total words',
    category: 'competitive',
    check: async function (userId) {
      var r = await pool.query(
        "SELECT transcribed_by, SUM(LENGTH(transcription_text) - LENGTH(REPLACE(transcription_text, ' ', '')) + 1) AS wc FROM sermons WHERE transcription_text IS NOT NULL AND transcribed_by IS NOT NULL GROUP BY transcribed_by ORDER BY wc DESC LIMIT 1"
      );
      if (r.rows.length > 0 && r.rows[0].transcribed_by === userId) {
        return { earned: true, detail: Math.round(r.rows[0].wc) + ' words' };
      }
      return { earned: false };
    },
  },

  // --- Milestone achievements ---
  {
    key: 'five_in_a_day',
    label: 'On Fire',
    icon: '🔥',
    desc: 'Earned points on 5 or more sermons in a single day',
    category: 'milestone',
    check: async function (userId) {
      var r = await pool.query(
        "SELECT DATE(created_at) AS d, COUNT(DISTINCT sermon_id) AS cnt FROM user_points WHERE user_id = $1 AND sermon_id IS NOT NULL GROUP BY d ORDER BY cnt DESC LIMIT 1",
        [userId]
      );
      if (r.rows.length > 0 && parseInt(r.rows[0].cnt, 10) >= 5) {
        return { earned: true, detail: r.rows[0].cnt + ' sermons on ' + new Date(r.rows[0].d).toLocaleDateString() };
      }
      return { earned: false };
    },
  },
  {
    key: 'sunday_scholar',
    label: 'Sunday Scholar',
    icon: '⛪',
    desc: 'Transcribed a sermon on a Sunday',
    category: 'milestone',
    check: async function (userId) {
      var r = await pool.query(
        "SELECT COUNT(*) FROM user_points WHERE user_id = $1 AND reason = 'transcription_complete' AND EXTRACT(DOW FROM created_at) = 0",
        [userId]
      );
      return { earned: parseInt(r.rows[0].count, 10) > 0 };
    },
  },
  {
    key: 'night_owl',
    label: 'Night Owl',
    icon: '🦉',
    desc: 'Worked on a sermon between midnight and 5 AM',
    category: 'milestone',
    check: async function (userId) {
      var r = await pool.query(
        "SELECT COUNT(*) FROM user_points WHERE user_id = $1 AND EXTRACT(HOUR FROM created_at) < 5",
        [userId]
      );
      return { earned: parseInt(r.rows[0].count, 10) > 0 };
    },
  },
  {
    key: 'early_bird',
    label: 'Early Bird',
    icon: '🐦',
    desc: 'Worked on a sermon between 5 AM and 7 AM',
    category: 'milestone',
    check: async function (userId) {
      var r = await pool.query(
        "SELECT COUNT(*) FROM user_points WHERE user_id = $1 AND EXTRACT(HOUR FROM created_at) >= 5 AND EXTRACT(HOUR FROM created_at) < 7",
        [userId]
      );
      return { earned: parseInt(r.rows[0].count, 10) > 0 };
    },
  },
  {
    key: 'streak_3',
    label: 'Consistent',
    icon: '📅',
    desc: 'Contributed on 3 consecutive days',
    category: 'milestone',
    check: async function (userId) {
      var r = await pool.query(
        "SELECT DISTINCT DATE(created_at) AS d FROM user_points WHERE user_id = $1 ORDER BY d",
        [userId]
      );
      var dates = r.rows.map(function (row) { return row.d; });
      var streak = 1;
      for (var i = 1; i < dates.length; i++) {
        var diff = (new Date(dates[i]) - new Date(dates[i - 1])) / 86400000;
        if (diff === 1) { streak++; if (streak >= 3) return { earned: true, detail: '3+ day streak' }; }
        else { streak = 1; }
      }
      return { earned: false };
    },
  },
  {
    key: 'streak_7',
    label: 'Devoted Worker',
    icon: '🗓️',
    desc: 'Contributed on 7 consecutive days',
    category: 'milestone',
    check: async function (userId) {
      var r = await pool.query(
        "SELECT DISTINCT DATE(created_at) AS d FROM user_points WHERE user_id = $1 ORDER BY d",
        [userId]
      );
      var dates = r.rows.map(function (row) { return row.d; });
      var streak = 1;
      for (var i = 1; i < dates.length; i++) {
        var diff = (new Date(dates[i]) - new Date(dates[i - 1])) / 86400000;
        if (diff === 1) { streak++; if (streak >= 7) return { earned: true, detail: '7+ day streak' }; }
        else { streak = 1; }
      }
      return { earned: false };
    },
  },
  {
    key: 'ten_complete',
    label: 'Double Digits',
    icon: '🔟',
    desc: 'Completed 10 transcriptions',
    category: 'milestone',
    check: async function (userId) {
      var r = await pool.query(
        "SELECT COUNT(*) FROM user_points WHERE user_id = $1 AND reason = 'transcription_complete'",
        [userId]
      );
      return { earned: parseInt(r.rows[0].count, 10) >= 10, detail: r.rows[0].count + ' completed' };
    },
  },
  {
    key: 'twenty_five_complete',
    label: 'Quarter Century',
    icon: '🏅',
    desc: 'Completed 25 transcriptions',
    category: 'milestone',
    check: async function (userId) {
      var r = await pool.query(
        "SELECT COUNT(*) FROM user_points WHERE user_id = $1 AND reason = 'transcription_complete'",
        [userId]
      );
      return { earned: parseInt(r.rows[0].count, 10) >= 25, detail: r.rows[0].count + ' completed' };
    },
  },
  {
    key: 'marathon',
    label: 'Marathon',
    icon: '🏃',
    desc: 'Transcribed a sermon with over 3,000 words',
    category: 'milestone',
    check: async function (userId) {
      var r = await pool.query(
        "SELECT COUNT(*) FROM user_points WHERE user_id = $1 AND reason = 'bonus_long_sermon'",
        [userId]
      );
      return { earned: parseInt(r.rows[0].count, 10) > 0 };
    },
  },
  {
    key: 'peer_reviewer',
    label: 'Peer Reviewer',
    icon: '🔍',
    desc: 'Completed your first transcription review',
    category: 'milestone',
    check: async function (userId) {
      var r = await pool.query(
        "SELECT COUNT(*) FROM user_points WHERE user_id = $1 AND reason = 'review_complete'",
        [userId]
      );
      return { earned: parseInt(r.rows[0].count, 10) > 0 };
    },
  },
  {
    key: 'quality_guardian',
    label: 'Quality Guardian',
    icon: '🛡️',
    desc: 'Completed 10 transcription reviews',
    category: 'milestone',
    check: async function (userId) {
      var r = await pool.query(
        "SELECT COUNT(*) FROM user_points WHERE user_id = $1 AND reason = 'review_complete'",
        [userId]
      );
      var cnt = parseInt(r.rows[0].count, 10);
      return { earned: cnt >= 10, detail: cnt + ' reviews' };
    },
  },
];

/**
 * Get all achievements for a user (runs all checks).
 */
async function getAchievements(userId) {
  var results = [];
  for (var i = 0; i < ACHIEVEMENT_DEFS.length; i++) {
    var def = ACHIEVEMENT_DEFS[i];
    try {
      var result = await def.check(userId);
      results.push({
        key: def.key,
        label: def.label,
        icon: def.icon,
        desc: def.desc,
        category: def.category,
        earned: result.earned,
        detail: result.detail || null,
      });
    } catch (err) {
      results.push({
        key: def.key, label: def.label, icon: def.icon, desc: def.desc,
        category: def.category, earned: false, detail: null,
      });
    }
  }
  return results;
}
