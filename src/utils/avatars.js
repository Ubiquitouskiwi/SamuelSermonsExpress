/**
 * Avatar options — 16 fun, unique icons for user profiles.
 * Plus 8 admin-exclusive avatars that stand out.
 */
const AVATARS = [
  { key: 'book', emoji: '📖', label: 'Open Book', admin: false },
  { key: 'quill', emoji: '🪶', label: 'Quill', admin: false },
  { key: 'scroll', emoji: '📜', label: 'Scroll', admin: false },
  { key: 'candle', emoji: '🕯️', label: 'Candle', admin: false },
  { key: 'dove', emoji: '🕊️', label: 'Dove', admin: false },
  { key: 'mountain', emoji: '⛰️', label: 'Mountain', admin: false },
  { key: 'star', emoji: '⭐', label: 'Star', admin: false },
  { key: 'tree', emoji: '🌳', label: 'Oak Tree', admin: false },
  { key: 'sun', emoji: '☀️', label: 'Sun', admin: false },
  { key: 'moon', emoji: '🌙', label: 'Crescent Moon', admin: false },
  { key: 'compass', emoji: '🧭', label: 'Compass', admin: false },
  { key: 'lantern', emoji: '🏮', label: 'Lantern', admin: false },
  { key: 'anchor', emoji: '⚓', label: 'Anchor', admin: false },
  { key: 'crown', emoji: '👑', label: 'Crown', admin: false },
  { key: 'shield', emoji: '🛡️', label: 'Shield', admin: false },
  { key: 'heart', emoji: '💛', label: 'Golden Heart', admin: false },
  // Admin-exclusive — rare, distinctive, unmistakable
  { key: 'dragon', emoji: '🐉', label: 'Dragon', admin: true },
  { key: 'phoenix', emoji: '🔥', label: 'Phoenix', admin: true },
  { key: 'diamond', emoji: '💠', label: 'Diamond', admin: true },
  { key: 'trident', emoji: '🔱', label: 'Trident', admin: true },
  { key: 'infinity', emoji: '♾️', label: 'Infinity', admin: true },
  { key: 'lightning', emoji: '⚡', label: 'Lightning', admin: true },
  { key: 'eye', emoji: '👁️‍🗨️', label: 'All-Seeing Eye', admin: true },
  { key: 'galaxy', emoji: '🌌', label: 'Galaxy', admin: true },
];

function getAvatar(key) {
  return AVATARS.find(a => a.key === key) || AVATARS[0];
}

function getAvatarsForRole(roles) {
  var isAdmin = roles && roles.includes('admin');
  if (isAdmin) return AVATARS;
  return AVATARS.filter(a => !a.admin);
}

module.exports = { AVATARS, getAvatar, getAvatarsForRole };
