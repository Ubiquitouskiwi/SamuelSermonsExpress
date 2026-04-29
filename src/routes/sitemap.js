const express = require('express');
const router = express.Router();
const pool = require('../db/pool');

router.get('/sitemap.xml', async (req, res) => {
  var siteUrl = process.env.SITE_URL || 'https://www.samuelsermons.com';
  try {
    var result = await pool.query('SELECT id, updated_at FROM sermons ORDER BY id');
    var urls = [
      { loc: siteUrl + '/', priority: '1.0' },
      { loc: siteUrl + '/sermons', priority: '0.9' },
      { loc: siteUrl + '/about', priority: '0.7' },
      { loc: siteUrl + '/feed', priority: '0.5' },
      { loc: siteUrl + '/bookmarks', priority: '0.4' },
    ];
    result.rows.forEach(function (s) {
      urls.push({
        loc: siteUrl + '/sermons/details?id=' + s.id,
        lastmod: s.updated_at ? new Date(s.updated_at).toISOString().split('T')[0] : undefined,
        priority: '0.8',
      });
    });

    var xml = '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
    urls.forEach(function (u) {
      xml += '  <url>\n    <loc>' + u.loc + '</loc>\n';
      if (u.lastmod) xml += '    <lastmod>' + u.lastmod + '</lastmod>\n';
      xml += '    <priority>' + u.priority + '</priority>\n  </url>\n';
    });
    xml += '</urlset>';

    res.set('Content-Type', 'application/xml');
    res.send(xml);
  } catch (err) {
    console.error('Sitemap error:', err);
    res.status(500).send('Sitemap unavailable');
  }
});

module.exports = router;
