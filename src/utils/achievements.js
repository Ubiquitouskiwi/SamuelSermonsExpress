/**
 * Achievement definitions — ~50 achievements across categories.
 * Each has a check function that returns { earned: bool, detail: string }
 */
const pool = require('../db/pool');

// Helper for streak checks
async function checkStreak(uid, target) {
  var r = await pool.query("SELECT DISTINCT DATE(created_at) AS d FROM user_points WHERE user_id=$1 ORDER BY d", [uid]);
  var dates = r.rows.map(function(row) { return row.d; });
  var streak = 1;
  for (var i = 1; i < dates.length; i++) {
    var diff = (new Date(dates[i]) - new Date(dates[i-1])) / 86400000;
    if (diff === 1) { streak++; if (streak >= target) return { earned: true, detail: streak + '+ days' }; }
    else { streak = 1; }
  }
  return { earned: false };
}

var ACHIEVEMENTS = [
  // === COMPETITIVE (shift based on current leader) ===
  { key: 'top_uploader', label: 'Top Uploader', icon: '📤', desc: 'Has the most sermon uploads', category: 'competitive',
    check: async function(uid) { var r = await pool.query("SELECT user_id, COUNT(*) AS cnt FROM user_points WHERE reason='sermon_uploaded' GROUP BY user_id ORDER BY cnt DESC LIMIT 1"); return r.rows.length > 0 && r.rows[0].user_id === uid ? { earned: true, detail: r.rows[0].cnt + ' uploads' } : { earned: false }; } },
  { key: 'top_transcriber', label: 'Top Transcriber', icon: '✍️', desc: 'Most completed transcriptions', category: 'competitive',
    check: async function(uid) { var r = await pool.query("SELECT user_id, COUNT(*) AS cnt FROM user_points WHERE reason='transcription_complete' GROUP BY user_id ORDER BY cnt DESC LIMIT 1"); return r.rows.length > 0 && r.rows[0].user_id === uid ? { earned: true, detail: r.rows[0].cnt + ' done' } : { earned: false }; } },
  { key: 'wordsmith', label: 'Wordsmith', icon: '📝', desc: 'Most total words transcribed', category: 'competitive',
    check: async function(uid) { var r = await pool.query("SELECT transcribed_by AS user_id, SUM(LENGTH(transcription_text)-LENGTH(REPLACE(transcription_text,' ',''))+1) AS wc FROM sermons WHERE transcription_text IS NOT NULL AND transcribed_by IS NOT NULL GROUP BY transcribed_by ORDER BY wc DESC LIMIT 1"); return r.rows.length > 0 && r.rows[0].user_id === uid ? { earned: true, detail: Math.round(r.rows[0].wc) + ' words' } : { earned: false }; } },
  { key: 'top_reviewer', label: 'Top Reviewer', icon: '🔍', desc: 'Most completed reviews', category: 'competitive',
    check: async function(uid) { var r = await pool.query("SELECT user_id, COUNT(*) AS cnt FROM user_points WHERE reason='review_complete' GROUP BY user_id ORDER BY cnt DESC LIMIT 1"); return r.rows.length > 0 && r.rows[0].user_id === uid ? { earned: true, detail: r.rows[0].cnt + ' reviews' } : { earned: false }; } },
  { key: 'most_points', label: 'Point Leader', icon: '🏆', desc: 'Highest total points', category: 'competitive',
    check: async function(uid) { var r = await pool.query("SELECT id, total_points FROM users WHERE is_active=true ORDER BY total_points DESC LIMIT 1"); return r.rows.length > 0 && r.rows[0].id === uid ? { earned: true, detail: r.rows[0].total_points + ' pts' } : { earned: false }; } },

  // === UPLOAD MILESTONES ===
  { key: 'first_upload', label: 'Scanner', icon: '📷', desc: 'Uploaded your first sermon', category: 'upload',
    check: async function(uid) { var r = await pool.query("SELECT COUNT(*) FROM user_points WHERE user_id=$1 AND reason='sermon_uploaded'", [uid]); return { earned: parseInt(r.rows[0].count) > 0 }; } },
  { key: 'five_uploads', label: 'Batch Scanner', icon: '📚', desc: 'Uploaded 5 sermons', category: 'upload',
    check: async function(uid) { var r = await pool.query("SELECT COUNT(*) FROM user_points WHERE user_id=$1 AND reason='sermon_uploaded'", [uid]); var c = parseInt(r.rows[0].count); return { earned: c >= 5, detail: c + ' uploads' }; } },
  { key: 'ten_uploads', label: 'Archive Builder', icon: '🏗️', desc: 'Uploaded 10 sermons', category: 'upload',
    check: async function(uid) { var r = await pool.query("SELECT COUNT(*) FROM user_points WHERE user_id=$1 AND reason='sermon_uploaded'", [uid]); var c = parseInt(r.rows[0].count); return { earned: c >= 10, detail: c + ' uploads' }; } },
  { key: 'twentyfive_uploads', label: 'Archivist', icon: '🗄️', desc: 'Uploaded 25 sermons', category: 'upload',
    check: async function(uid) { var r = await pool.query("SELECT COUNT(*) FROM user_points WHERE user_id=$1 AND reason='sermon_uploaded'", [uid]); var c = parseInt(r.rows[0].count); return { earned: c >= 25, detail: c + ' uploads' }; } },
  { key: 'fifty_uploads', label: 'Master Archivist', icon: '📦', desc: 'Uploaded 50 sermons', category: 'upload',
    check: async function(uid) { var r = await pool.query("SELECT COUNT(*) FROM user_points WHERE user_id=$1 AND reason='sermon_uploaded'", [uid]); var c = parseInt(r.rows[0].count); return { earned: c >= 50, detail: c + ' uploads' }; } },

  // === TRANSCRIPTION MILESTONES ===
  { key: 'first_transcription', label: 'First Words', icon: '✏️', desc: 'Started your first transcription', category: 'transcription',
    check: async function(uid) { var r = await pool.query("SELECT COUNT(*) FROM user_points WHERE user_id=$1 AND reason='transcription_started'", [uid]); return { earned: parseInt(r.rows[0].count) > 0 }; } },
  { key: 'five_complete', label: 'Getting Started', icon: '📖', desc: 'Completed 5 transcriptions', category: 'transcription',
    check: async function(uid) { var r = await pool.query("SELECT COUNT(*) FROM user_points WHERE user_id=$1 AND reason='transcription_complete'", [uid]); var c = parseInt(r.rows[0].count); return { earned: c >= 5, detail: c + ' done' }; } },
  { key: 'ten_complete', label: 'Double Digits', icon: '🔟', desc: 'Completed 10 transcriptions', category: 'transcription',
    check: async function(uid) { var r = await pool.query("SELECT COUNT(*) FROM user_points WHERE user_id=$1 AND reason='transcription_complete'", [uid]); var c = parseInt(r.rows[0].count); return { earned: c >= 10, detail: c + ' done' }; } },
  { key: 'twentyfive_complete', label: 'Quarter Century', icon: '🏅', desc: 'Completed 25 transcriptions', category: 'transcription',
    check: async function(uid) { var r = await pool.query("SELECT COUNT(*) FROM user_points WHERE user_id=$1 AND reason='transcription_complete'", [uid]); var c = parseInt(r.rows[0].count); return { earned: c >= 25, detail: c + ' done' }; } },
  { key: 'fifty_complete', label: 'Half Century', icon: '🎖️', desc: 'Completed 50 transcriptions', category: 'transcription',
    check: async function(uid) { var r = await pool.query("SELECT COUNT(*) FROM user_points WHERE user_id=$1 AND reason='transcription_complete'", [uid]); var c = parseInt(r.rows[0].count); return { earned: c >= 50, detail: c + ' done' }; } },
  { key: 'hundred_complete', label: 'Centurion', icon: '💯', desc: 'Completed 100 transcriptions', category: 'transcription',
    check: async function(uid) { var r = await pool.query("SELECT COUNT(*) FROM user_points WHERE user_id=$1 AND reason='transcription_complete'", [uid]); var c = parseInt(r.rows[0].count); return { earned: c >= 100, detail: c + ' done' }; } },

  // === WORD COUNT MILESTONES ===
  { key: 'thousand_words', label: 'Thousand Words', icon: '📄', desc: 'Transcribed 1,000 total words', category: 'transcription',
    check: async function(uid) { var r = await pool.query("SELECT COALESCE(SUM(LENGTH(transcription_text)-LENGTH(REPLACE(transcription_text,' ',''))+1),0) AS wc FROM sermons WHERE transcribed_by=$1 AND transcription_text IS NOT NULL", [uid]); var wc = parseInt(r.rows[0].wc); return { earned: wc >= 1000, detail: wc + ' words' }; } },
  { key: 'five_thousand_words', label: 'Prolific', icon: '📃', desc: 'Transcribed 5,000 total words', category: 'transcription',
    check: async function(uid) { var r = await pool.query("SELECT COALESCE(SUM(LENGTH(transcription_text)-LENGTH(REPLACE(transcription_text,' ',''))+1),0) AS wc FROM sermons WHERE transcribed_by=$1 AND transcription_text IS NOT NULL", [uid]); var wc = parseInt(r.rows[0].wc); return { earned: wc >= 5000, detail: wc + ' words' }; } },
  { key: 'ten_thousand_words', label: 'Novelist', icon: '📕', desc: 'Transcribed 10,000 total words', category: 'transcription',
    check: async function(uid) { var r = await pool.query("SELECT COALESCE(SUM(LENGTH(transcription_text)-LENGTH(REPLACE(transcription_text,' ',''))+1),0) AS wc FROM sermons WHERE transcribed_by=$1 AND transcription_text IS NOT NULL", [uid]); var wc = parseInt(r.rows[0].wc); return { earned: wc >= 10000, detail: wc + ' words' }; } },
  { key: 'fifty_thousand_words', label: 'Epic Scribe', icon: '📗', desc: 'Transcribed 50,000 total words', category: 'transcription',
    check: async function(uid) { var r = await pool.query("SELECT COALESCE(SUM(LENGTH(transcription_text)-LENGTH(REPLACE(transcription_text,' ',''))+1),0) AS wc FROM sermons WHERE transcribed_by=$1 AND transcription_text IS NOT NULL", [uid]); var wc = parseInt(r.rows[0].wc); return { earned: wc >= 50000, detail: wc + ' words' }; } },

  // === REVIEW MILESTONES ===
  { key: 'peer_reviewer', label: 'Peer Reviewer', icon: '🔍', desc: 'Completed your first review', category: 'review',
    check: async function(uid) { var r = await pool.query("SELECT COUNT(*) FROM user_points WHERE user_id=$1 AND reason='review_complete'", [uid]); return { earned: parseInt(r.rows[0].count) > 0 }; } },
  { key: 'five_reviews', label: 'Careful Eye', icon: '👁️', desc: 'Completed 5 reviews', category: 'review',
    check: async function(uid) { var r = await pool.query("SELECT COUNT(*) FROM user_points WHERE user_id=$1 AND reason='review_complete'", [uid]); var c = parseInt(r.rows[0].count); return { earned: c >= 5, detail: c + ' reviews' }; } },
  { key: 'quality_guardian', label: 'Quality Guardian', icon: '🛡️', desc: 'Completed 10 reviews', category: 'review',
    check: async function(uid) { var r = await pool.query("SELECT COUNT(*) FROM user_points WHERE user_id=$1 AND reason='review_complete'", [uid]); var c = parseInt(r.rows[0].count); return { earned: c >= 10, detail: c + ' reviews' }; } },
  { key: 'twenty_reviews', label: 'Editor', icon: '📋', desc: 'Completed 20 reviews', category: 'review',
    check: async function(uid) { var r = await pool.query("SELECT COUNT(*) FROM user_points WHERE user_id=$1 AND reason='review_complete'", [uid]); var c = parseInt(r.rows[0].count); return { earned: c >= 20, detail: c + ' reviews' }; } },
  { key: 'helpful_comments', label: 'Helpful Critic', icon: '💬', desc: 'Left 20 review comments', category: 'review',
    check: async function(uid) { var r = await pool.query("SELECT COUNT(*) FROM user_points WHERE user_id=$1 AND reason='review_comment'", [uid]); var c = parseInt(r.rows[0].count); return { earned: c >= 20, detail: c + ' comments' }; } },
  { key: 'fifty_comments', label: 'Commentator', icon: '🗣️', desc: 'Left 50 review comments', category: 'review',
    check: async function(uid) { var r = await pool.query("SELECT COUNT(*) FROM user_points WHERE user_id=$1 AND reason='review_comment'", [uid]); var c = parseInt(r.rows[0].count); return { earned: c >= 50, detail: c + ' comments' }; } },

  // === TIME-BASED ===
  { key: 'sunday_scholar', label: 'Sunday Scholar', icon: '⛪', desc: 'Transcribed on a Sunday', category: 'time',
    check: async function(uid) { var r = await pool.query("SELECT COUNT(*) FROM user_points WHERE user_id=$1 AND EXTRACT(DOW FROM created_at)=0", [uid]); return { earned: parseInt(r.rows[0].count) > 0 }; } },
  { key: 'night_owl', label: 'Night Owl', icon: '🦉', desc: 'Worked between midnight and 5 AM', category: 'time',
    check: async function(uid) { var r = await pool.query("SELECT COUNT(*) FROM user_points WHERE user_id=$1 AND EXTRACT(HOUR FROM created_at)<5", [uid]); return { earned: parseInt(r.rows[0].count) > 0 }; } },
  { key: 'early_bird', label: 'Early Bird', icon: '🐦', desc: 'Worked between 5 AM and 7 AM', category: 'time',
    check: async function(uid) { var r = await pool.query("SELECT COUNT(*) FROM user_points WHERE user_id=$1 AND EXTRACT(HOUR FROM created_at)>=5 AND EXTRACT(HOUR FROM created_at)<7", [uid]); return { earned: parseInt(r.rows[0].count) > 0 }; } },
  { key: 'lunch_break', label: 'Lunch Break Hero', icon: '🥪', desc: 'Worked between noon and 1 PM', category: 'time',
    check: async function(uid) { var r = await pool.query("SELECT COUNT(*) FROM user_points WHERE user_id=$1 AND EXTRACT(HOUR FROM created_at)=12", [uid]); return { earned: parseInt(r.rows[0].count) > 0 }; } },
  { key: 'weekend_warrior', label: 'Weekend Warrior', icon: '⚔️', desc: 'Worked on both Saturday and Sunday', category: 'time',
    check: async function(uid) { var r = await pool.query("SELECT DISTINCT EXTRACT(DOW FROM created_at) AS d FROM user_points WHERE user_id=$1", [uid]); var days = r.rows.map(function(x){return parseInt(x.d)}); return { earned: days.includes(0) && days.includes(6) }; } },

  // === STREAKS ===
  { key: 'streak_3', label: 'Consistent', icon: '📅', desc: '3-day contribution streak', category: 'streak',
    check: async function(uid) { return checkStreak(uid, 3); } },
  { key: 'streak_7', label: 'Devoted Worker', icon: '🗓️', desc: '7-day contribution streak', category: 'streak',
    check: async function(uid) { return checkStreak(uid, 7); } },
  { key: 'streak_14', label: 'Two Weeks Strong', icon: '💪', desc: '14-day contribution streak', category: 'streak',
    check: async function(uid) { return checkStreak(uid, 14); } },
  { key: 'streak_30', label: 'Monthly Devotion', icon: '🌟', desc: '30-day contribution streak', category: 'streak',
    check: async function(uid) { return checkStreak(uid, 30); } },

  // === PRODUCTIVITY ===
  { key: 'five_in_a_day', label: 'On Fire', icon: '🔥', desc: 'Worked on 5+ sermons in one day', category: 'productivity',
    check: async function(uid) { var r = await pool.query("SELECT DATE(created_at) AS d, COUNT(DISTINCT sermon_id) AS cnt FROM user_points WHERE user_id=$1 AND sermon_id IS NOT NULL GROUP BY d ORDER BY cnt DESC LIMIT 1", [uid]); return r.rows.length > 0 && parseInt(r.rows[0].cnt) >= 5 ? { earned: true, detail: r.rows[0].cnt + ' sermons' } : { earned: false }; } },
  { key: 'ten_in_a_day', label: 'Unstoppable', icon: '⚡', desc: 'Worked on 10+ sermons in one day', category: 'productivity',
    check: async function(uid) { var r = await pool.query("SELECT DATE(created_at) AS d, COUNT(DISTINCT sermon_id) AS cnt FROM user_points WHERE user_id=$1 AND sermon_id IS NOT NULL GROUP BY d ORDER BY cnt DESC LIMIT 1", [uid]); return r.rows.length > 0 && parseInt(r.rows[0].cnt) >= 10 ? { earned: true, detail: r.rows[0].cnt + ' sermons' } : { earned: false }; } },
  { key: 'marathon', label: 'Marathon', icon: '🏃', desc: 'Transcribed a sermon over 3,000 words', category: 'productivity',
    check: async function(uid) { var r = await pool.query("SELECT COUNT(*) FROM user_points WHERE user_id=$1 AND reason='bonus_long_sermon'", [uid]); return { earned: parseInt(r.rows[0].count) > 0 }; } },
  { key: 'speed_demon', label: 'Speed Demon', icon: '💨', desc: 'Completed 3 transcriptions in one day', category: 'productivity',
    check: async function(uid) { var r = await pool.query("SELECT DATE(created_at) AS d, COUNT(*) AS cnt FROM user_points WHERE user_id=$1 AND reason='transcription_complete' GROUP BY d ORDER BY cnt DESC LIMIT 1", [uid]); return r.rows.length > 0 && parseInt(r.rows[0].cnt) >= 3 ? { earned: true } : { earned: false }; } },
  { key: 'pipeline_master', label: 'Pipeline Master', icon: '🔧', desc: 'Moved 10 sermons through stages', category: 'productivity',
    check: async function(uid) { var r = await pool.query("SELECT COUNT(*) FROM user_points WHERE user_id=$1 AND reason='sermon_stage_moved'", [uid]); var c = parseInt(r.rows[0].count); return { earned: c >= 10, detail: c + ' moves' }; } },

  // === VARIETY & SPECIAL ===
  { key: 'all_types', label: 'Well Rounded', icon: '🎯', desc: 'Transcribed every sermon type', category: 'special',
    check: async function(uid) { var r = await pool.query("SELECT COUNT(DISTINCT sermon_type) AS cnt FROM sermons WHERE transcribed_by=$1 AND transcription_status='complete'", [uid]); var total = await pool.query("SELECT COUNT(DISTINCT sermon_type) AS cnt FROM sermons"); return { earned: parseInt(r.rows[0].cnt) >= parseInt(total.rows[0].cnt) && parseInt(r.rows[0].cnt) > 1 }; } },
  { key: 'funeral_specialist', label: 'Funeral Specialist', icon: '🕊️', desc: 'Transcribed 5 funeral sermons', category: 'special',
    check: async function(uid) { var r = await pool.query("SELECT COUNT(*) FROM sermons WHERE transcribed_by=$1 AND sermon_type='funeral' AND transcription_status='complete'", [uid]); return { earned: parseInt(r.rows[0].count) >= 5 }; } },
  { key: 'special_day_fan', label: 'Special Occasions', icon: '🎉', desc: 'Transcribed 3 special day sermons', category: 'special',
    check: async function(uid) { var r = await pool.query("SELECT COUNT(*) FROM sermons WHERE transcribed_by=$1 AND sermon_type='special day' AND transcription_status='complete'", [uid]); return { earned: parseInt(r.rows[0].count) >= 3 }; } },
  { key: 'both_collections', label: 'Both Sides', icon: '↔️', desc: 'Transcribed from both collections', category: 'special',
    check: async function(uid) { var r = await pool.query("SELECT COUNT(DISTINCT collection) AS cnt FROM sermons WHERE transcribed_by=$1 AND transcription_status='complete'", [uid]); return { earned: parseInt(r.rows[0].cnt) >= 2 }; } },

  // === HOLIDAYS & FUN ===
  { key: 'new_year', label: 'New Year Spirit', icon: '🎆', desc: 'Contributed on January 1st', category: 'fun',
    check: async function(uid) { var r = await pool.query("SELECT COUNT(*) FROM user_points WHERE user_id=$1 AND EXTRACT(MONTH FROM created_at)=1 AND EXTRACT(DAY FROM created_at)=1", [uid]); return { earned: parseInt(r.rows[0].count) > 0 }; } },
  { key: 'christmas', label: 'Christmas Spirit', icon: '🎄', desc: 'Contributed on Dec 24th or 25th', category: 'fun',
    check: async function(uid) { var r = await pool.query("SELECT COUNT(*) FROM user_points WHERE user_id=$1 AND EXTRACT(MONTH FROM created_at)=12 AND EXTRACT(DAY FROM created_at) IN (24,25)", [uid]); return { earned: parseInt(r.rows[0].count) > 0 }; } },
  { key: 'valentines', label: 'Labor of Love', icon: '❤️', desc: 'Contributed on Valentine\'s Day', category: 'fun',
    check: async function(uid) { var r = await pool.query("SELECT COUNT(*) FROM user_points WHERE user_id=$1 AND EXTRACT(MONTH FROM created_at)=2 AND EXTRACT(DAY FROM created_at)=14", [uid]); return { earned: parseInt(r.rows[0].count) > 0 }; } },
  { key: 'halloween', label: 'Spooky Scholar', icon: '🎃', desc: 'Contributed on Halloween', category: 'fun',
    check: async function(uid) { var r = await pool.query("SELECT COUNT(*) FROM user_points WHERE user_id=$1 AND EXTRACT(MONTH FROM created_at)=10 AND EXTRACT(DAY FROM created_at)=31", [uid]); return { earned: parseInt(r.rows[0].count) > 0 }; } },
  { key: 'independence', label: 'Patriot Scholar', icon: '🇺🇸', desc: 'Contributed on July 4th', category: 'fun',
    check: async function(uid) { var r = await pool.query("SELECT COUNT(*) FROM user_points WHERE user_id=$1 AND EXTRACT(MONTH FROM created_at)=7 AND EXTRACT(DAY FROM created_at)=4", [uid]); return { earned: parseInt(r.rows[0].count) > 0 }; } },

  // === LONGEVITY ===
  { key: 'veteran', label: 'Veteran', icon: '🎖️', desc: 'Account over 6 months old', category: 'longevity',
    check: async function(uid) { var r = await pool.query("SELECT created_at FROM users WHERE id=$1", [uid]); if (!r.rows.length) return { earned: false }; return { earned: (Date.now() - new Date(r.rows[0].created_at)) / (30*24*60*60*1000) >= 6 }; } },
  { key: 'old_timer', label: 'Old Timer', icon: '⏳', desc: 'Account over 1 year old', category: 'longevity',
    check: async function(uid) { var r = await pool.query("SELECT created_at FROM users WHERE id=$1", [uid]); if (!r.rows.length) return { earned: false }; return { earned: (Date.now() - new Date(r.rows[0].created_at)) / (30*24*60*60*1000) >= 12 }; } },
];

/**
 * Get all achievements for a user.
 */
async function getAchievements(userId) {
  var results = [];
  for (var i = 0; i < ACHIEVEMENTS.length; i++) {
    var def = ACHIEVEMENTS[i];
    try {
      var result = await def.check(userId);
      results.push({ key: def.key, label: def.label, icon: def.icon, desc: def.desc, category: def.category, earned: result.earned, detail: result.detail || null });
    } catch (err) {
      results.push({ key: def.key, label: def.label, icon: def.icon, desc: def.desc, category: def.category, earned: false, detail: null });
    }
  }
  return results;
}

module.exports = { ACHIEVEMENTS, getAchievements };
