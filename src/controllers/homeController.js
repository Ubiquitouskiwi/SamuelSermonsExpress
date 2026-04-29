const asyncHandler = require("express-async-handler");
const pool = require('../db/pool');

// Display home page with Sermon of the Day
exports.index = asyncHandler(async (req, res, next) => {
    let sermonOfDay = null;
    try {
      // Pick a sermon based on the day of year (rotates daily, deterministic)
      const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
      const countResult = await pool.query('SELECT COUNT(*) FROM sermons');
      const total = parseInt(countResult.rows[0].count, 10);
      if (total > 0) {
        const offset = dayOfYear % total;
        const result = await pool.query(
          'SELECT id, title, sermon_type AS "sermonType" FROM sermons ORDER BY id LIMIT 1 OFFSET $1',
          [offset]
        );
        if (result.rows.length > 0) sermonOfDay = result.rows[0];
      }
    } catch (err) {
      // Don't break the home page if DB is down
    }
    res.render("index", { title: "Samuel Sermons", pageTitle: null, sermonOfDay });
});
