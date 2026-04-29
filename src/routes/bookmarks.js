const express = require('express');
const router = express.Router();

// Bookmarks page — all data is in localStorage, rendered client-side
router.get('/', (req, res) => {
  res.render('bookmarks');
});

module.exports = router;
