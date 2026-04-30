const express = require('express');
const router = express.Router();
const pool = require('../db/pool');

// RSS 2.0 feed of sermon events (public-facing: only uploads and completed transcriptions)
router.get('/rss', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT e.id, e.event_type, e.title, e.description, e.created_at,
              s.title AS sermon_title, s.id AS sermon_id
       FROM sermon_events e
       LEFT JOIN sermons s ON e.sermon_id = s.id
       WHERE e.event_type IN ('sermon_added', 'transcription_complete')
       ORDER BY e.created_at DESC
       LIMIT 50`
    );

    var siteUrl = process.env.SITE_URL || 'https://www.samuelsermons.com';

    // Add birthday announcement on May 6th
    var now = new Date();
    if (now.getMonth() === 4 && now.getDate() === 6) {
      var age = now.getFullYear() - 1940;
      var birthdayItem = {
        id: 'birthday-' + now.getFullYear(),
        event_type: 'birthday',
        title: 'Happy Birthday, Rev. Samuel Starling',
        description: 'Today marks what would have been Rev. Samuel Starling\'s ' + age + 'th birthday. Visit the site to leave a message in his memory.',
        created_at: now,
        sermon_id: null,
      };
      result.rows.unshift(birthdayItem);
    }

    var items = result.rows.map(function (e) {
      var link = e.sermon_id ? siteUrl + '/sermons/details?id=' + e.sermon_id : siteUrl;
      var friendlyTitle, desc;
      if (e.event_type === 'birthday') {
        friendlyTitle = e.title;
        desc = e.description;
        link = siteUrl;
      } else if (e.event_type === 'sermon_added') {
        friendlyTitle = 'Newly Uploaded: ' + (e.sermon_title || 'New Sermon');
        desc = 'A new sermon has been added to the collection.';
      } else {
        friendlyTitle = 'Newly Transcribed: ' + (e.sermon_title || 'Sermon');
        desc = 'A sermon transcription has been completed and is now available.';
      }
      return '    <item>\n' +
        '      <title>' + escXml(friendlyTitle) + '</title>\n' +
        '      <link>' + escXml(link) + '</link>\n' +
        '      <description>' + escXml(desc) + '</description>\n' +
        '      <pubDate>' + new Date(e.created_at).toUTCString() + '</pubDate>\n' +
        '      <guid isPermaLink="false">event-' + e.id + '</guid>\n' +
        '    </item>';
    }).join('\n');

    var rss = '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n' +
      '  <channel>\n' +
      '    <title>Samuel\'s Sermons — Activity Feed</title>\n' +
      '    <link>' + siteUrl + '</link>\n' +
      '    <description>Follow the progress of digitizing and transcribing Rev. Samuel Starling\'s sermon collection.</description>\n' +
      '    <language>en-us</language>\n' +
      '    <lastBuildDate>' + new Date().toUTCString() + '</lastBuildDate>\n' +
      '    <atom:link href="' + siteUrl + '/feed/rss" rel="self" type="application/rss+xml"/>\n' +
      items + '\n' +
      '  </channel>\n' +
      '</rss>';

    res.set('Content-Type', 'application/rss+xml; charset=utf-8');
    res.send(rss);
  } catch (err) {
    console.error('RSS feed error:', err);
    res.status(500).send('Feed unavailable');
  }
});

// Human-readable feed page (public-facing: only uploads and completed transcriptions)
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT e.id, e.event_type, e.title, e.description, e.created_at,
              s.title AS sermon_title, s.id AS sermon_id
       FROM sermon_events e
       LEFT JOIN sermons s ON e.sermon_id = s.id
       WHERE e.event_type IN ('sermon_added', 'transcription_complete')
       ORDER BY e.created_at DESC
       LIMIT 50`
    );
    res.render('feed', { events: result.rows });
  } catch (err) {
    console.error('Feed page error:', err);
    res.render('feed', { events: [] });
  }
});

function escXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

module.exports = router;
