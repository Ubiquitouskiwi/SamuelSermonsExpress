/**
 * Avatar options:
 * - 16 standard (available to everyone)
 * - 8 admin-exclusive
 * - 10 unlockable (tied to specific achievements or badge tiers)
 *
 * unlockReq: { type: 'badge', key: 'badge_key' } or { type: 'achievement', key: 'achievement_key' }
 */
const AVATARS = [
  // --- Standard (everyone) ---
  { key: 'book', emoji: '📖', label: 'Open Book', tier: 'standard' },
  { key: 'quill', emoji: '🪶', label: 'Quill', tier: 'standard' },
  { key: 'scroll', emoji: '📜', label: 'Scroll', tier: 'standard' },
  { key: 'candle', emoji: '🕯️', label: 'Candle', tier: 'standard' },
  { key: 'dove', emoji: '🕊️', label: 'Dove', tier: 'standard' },
  { key: 'mountain', emoji: '⛰️', label: 'Mountain', tier: 'standard' },
  { key: 'star', emoji: '⭐', label: 'Star', tier: 'standard' },
  { key: 'tree', emoji: '🌳', label: 'Oak Tree', tier: 'standard' },
  { key: 'sun', emoji: '☀️', label: 'Sun', tier: 'standard' },
  { key: 'moon', emoji: '🌙', label: 'Crescent Moon', tier: 'standard' },
  { key: 'compass', emoji: '🧭', label: 'Compass', tier: 'standard' },
  { key: 'lantern', emoji: '🏮', label: 'Lantern', tier: 'standard' },
  { key: 'anchor', emoji: '⚓', label: 'Anchor', tier: 'standard' },
  { key: 'crown', emoji: '👑', label: 'Crown', tier: 'standard' },
  { key: 'shield', emoji: '🛡️', label: 'Shield', tier: 'standard' },
  { key: 'heart', emoji: '💛', label: 'Golden Heart', tier: 'standard' },

  // --- Admin-exclusive ---
  { key: 'dragon', emoji: '🐉', label: 'Dragon', tier: 'admin' },
  { key: 'phoenix', emoji: '🔥', label: 'Phoenix', tier: 'admin' },
  { key: 'diamond', emoji: '💠', label: 'Diamond', tier: 'admin' },
  { key: 'trident', emoji: '🔱', label: 'Trident', tier: 'admin' },
  { key: 'infinity', emoji: '♾️', label: 'Infinity', tier: 'admin' },
  { key: 'lightning', emoji: '⚡', label: 'Lightning', tier: 'admin' },
  { key: 'eye', emoji: '👁️‍🗨️', label: 'All-Seeing Eye', tier: 'admin' },
  { key: 'galaxy', emoji: '🌌', label: 'Galaxy', tier: 'admin' },

  // --- Developer-exclusive ---
  { key: 'terminal', emoji: '💻', label: 'Terminal', tier: 'role', role: 'developer' },
  { key: 'gear_dev', emoji: '⚙️', label: 'Gearworks', tier: 'role', role: 'developer' },

  // --- Transcriber-exclusive ---
  { key: 'typewriter', emoji: '⌨️', label: 'Typewriter', tier: 'role', role: 'transcriber' },
  { key: 'inkwell', emoji: '🖋️', label: 'Inkwell', tier: 'role', role: 'transcriber' },

  // --- Uploader-exclusive ---
  { key: 'camera', emoji: '📸', label: 'Camera', tier: 'role', role: 'uploader' },
  { key: 'filing', emoji: '🗂️', label: 'Filing Cabinet', tier: 'role', role: 'uploader' },

  // --- Unlockable (tied to achievements/badges) ---
  { key: 'flame_spirit', emoji: '🔥', label: 'Flame Spirit', tier: 'unlock', unlockReq: { type: 'badge', key: 'dedicated' }, unlockHint: 'Earn the Dedicated badge (500 pts)' },
  { key: 'gem', emoji: '💎', label: 'Gem', tier: 'unlock', unlockReq: { type: 'badge', key: 'devoted' }, unlockHint: 'Earn the Devoted badge (1,000 pts)' },
  { key: 'temple', emoji: '🏛️', label: 'Temple', tier: 'unlock', unlockReq: { type: 'badge', key: 'pillar' }, unlockHint: 'Earn the Pillar badge (2,500 pts)' },
  { key: 'ancient_scroll', emoji: '🗞️', label: 'Ancient Scroll', tier: 'unlock', unlockReq: { type: 'badge', key: 'legacy_keeper' }, unlockHint: 'Earn the Legacy Keeper badge (5,000 pts)' },
  { key: 'holy_cross', emoji: '✝️', label: 'Holy Cross', tier: 'legendary', unlockReq: { type: 'badge', key: 'samuels_scribe' }, unlockHint: "Earn Samuel's Scribe badge (10,000 pts) — the highest honor" },
  { key: 'owl', emoji: '🦉', label: 'Wise Owl', tier: 'unlock', unlockReq: { type: 'achievement', key: 'night_owl' }, unlockHint: 'Earn the Night Owl achievement' },
  { key: 'rocket', emoji: '🚀', label: 'Rocket', tier: 'unlock', unlockReq: { type: 'achievement', key: 'speed_demon' }, unlockHint: 'Earn the Speed Demon achievement' },
  { key: 'trophy', emoji: '🏆', label: 'Trophy', tier: 'unlock', unlockReq: { type: 'achievement', key: 'most_points' }, unlockHint: 'Be the Point Leader' },
  { key: 'church', emoji: '⛪', label: 'Church', tier: 'unlock', unlockReq: { type: 'achievement', key: 'sunday_scholar' }, unlockHint: 'Earn the Sunday Scholar achievement' },
  { key: 'comet', emoji: '☄️', label: 'Comet', tier: 'unlock', unlockReq: { type: 'achievement', key: 'streak_30' }, unlockHint: 'Earn the Monthly Devotion streak' },

  // --- Creator (one-of-one, only for the site creator) ---
  { key: 'creator', emoji: 'λ', label: 'Creator', tier: 'creator', creatorEmail: 'developer@samuelsermons.com' },
];

function getAvatar(key) {
  return AVATARS.find(a => a.key === key) || AVATARS[0];
}

/**
 * Get available avatars for a user based on their roles, badges, achievements, and email.
 */
function getAvatarsForUser(roles, badges, achievements, email) {
  var isAdmin = roles && roles.includes('admin');
  var earnedBadgeKeys = (badges || []).map(function(b) { return b.key; });
  var earnedAchievementKeys = (achievements || []).filter(function(a) { return a.earned; }).map(function(a) { return a.key; });

  return AVATARS.filter(function(avatar) {
    // Creator tier: only visible to the specific email
    if (avatar.tier === 'creator') {
      return email && email === avatar.creatorEmail;
    }
    return true;
  }).map(function(avatar) {
    var available = false;
    var locked = false;

    if (avatar.tier === 'standard') {
      available = true;
    } else if (avatar.tier === 'admin') {
      available = isAdmin;
      locked = !isAdmin;
    } else if (avatar.tier === 'role') {
      available = isAdmin || (roles && roles.includes(avatar.role));
      locked = !available;
    } else if (avatar.tier === 'unlock' || avatar.tier === 'legendary') {
      var req = avatar.unlockReq;
      if (req.type === 'badge') {
        available = earnedBadgeKeys.includes(req.key);
      } else if (req.type === 'achievement') {
        available = earnedAchievementKeys.includes(req.key);
      }
      locked = !available;
    } else if (avatar.tier === 'creator') {
      available = true; // Already filtered above
    }

    return Object.assign({}, avatar, { available: available, locked: locked });
  });
}

// Backward compat
function getAvatarsForRole(roles) {
  return getAvatarsForUser(roles, [], []);
}

module.exports = { AVATARS, getAvatar, getAvatarsForRole, getAvatarsForUser };
