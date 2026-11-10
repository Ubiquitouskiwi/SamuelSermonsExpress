/**
 * Search-engine checks: canonical links, JSON-LD, robots rules, 404s and the sitemap.
 * The DB pool is mocked; by default every query fails so pages use the
 * hardcoded fallback sermon data, like a fresh checkout without Postgres.
 */
process.env.SITE_URL = 'https://samuelsermons.com';

jest.mock('./db/pool', () => ({ query: jest.fn(), on: jest.fn(), end: jest.fn() }));
jest.mock('connect-pg-simple', () => (session) =>
  class extends session.MemoryStore {}
);

const request = require('supertest');
const pool = require('./db/pool');
const app = require('./app');
const seo = require('./utils/seo');

const SITE = 'https://samuelsermons.com';

function canonicalOf(html) {
  const m = /<link rel="canonical" href="([^"]+)"/.exec(html);
  return m ? m[1] : null;
}

function jsonLdOf(html) {
  const m = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html);
  return m ? JSON.parse(m[1]) : null;
}

function typesOf(ld) {
  return ld['@graph'].map((n) => n['@type']);
}

function metaContent(html, attr, name) {
  const re = new RegExp('<meta ' + attr + '="' + name.replace(/[:]/g, '\\:') + '" content="([^"]*)"');
  const m = re.exec(html);
  return m ? m[1] : null;
}

beforeEach(() => {
  pool.query.mockReset();
  pool.query.mockRejectedValue(new Error('no database in tests'));
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  console.warn.mockRestore();
  console.error.mockRestore();
});

describe('canonical URLs', () => {
  test('home page', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(canonicalOf(res.text)).toBe(SITE + '/');
    expect(res.text).not.toContain('name="robots"');
  });

  test('/sermons ignores query strings and trailing slashes', async () => {
    const res = await request(app).get('/sermons/?utm_source=x');
    expect(res.status).toBe(200);
    expect(canonicalOf(res.text)).toBe(SITE + '/sermons');
  });

  test('sermon detail keeps the id', async () => {
    const res = await request(app).get('/sermons/details?id=1&ref=share');
    expect(res.status).toBe(200);
    expect(canonicalOf(res.text)).toBe(SITE + '/sermons/details?id=1');
    expect(metaContent(res.text, 'property', 'og:url')).toBe(SITE + '/sermons/details?id=1');
  });

  test('defaults to the apex domain when SITE_URL is unset', () => {
    const saved = process.env.SITE_URL;
    delete process.env.SITE_URL;
    try {
      expect(seo.siteUrl()).toBe('https://samuelsermons.com');
    } finally {
      process.env.SITE_URL = saved;
    }
  });
});

describe('JSON-LD', () => {
  test('home has WebSite and Person', async () => {
    const res = await request(app).get('/');
    const ld = jsonLdOf(res.text);
    expect(ld['@context']).toBe('https://schema.org');
    expect(typesOf(ld)).toEqual(['WebSite', 'Person']);
    expect(ld['@graph'][0]).toMatchObject({ name: "Samuel's Sermons", url: SITE + '/' });
    expect(ld['@graph'][1]).toMatchObject({ name: 'Samuel Starling', honorificPrefix: 'Rev.' });
  });

  test('other public pages get a BreadcrumbList', async () => {
    const res = await request(app).get('/about');
    const ld = jsonLdOf(res.text);
    expect(typesOf(ld)).toEqual(['BreadcrumbList']);
    expect(ld['@graph'][0].itemListElement.map((i) => i.name)).toEqual(['Home', 'About']);
  });

  test('sermon page without transcription: CreativeWork + Person + BreadcrumbList', async () => {
    const res = await request(app).get('/sermons/details?id=1');
    const ld = jsonLdOf(res.text);
    expect(typesOf(ld)).toEqual(['CreativeWork', 'Person', 'BreadcrumbList']);
    const work = ld['@graph'][0];
    expect(work.name).toBe('Christ Above All');
    expect(work.author['@id']).toBe(ld['@graph'][1]['@id']);
    expect(work.datePublished).toBeUndefined();
    expect(ld['@graph'][2].itemListElement.map((i) => i.name)).toEqual(['Home', 'Sermons', 'Christ Above All']);
  });

  test('sermon page with transcription: Article and a description from the text', async () => {
    const text = 'In the beginning was the Word. '.repeat(20);
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 7, title: '7. A Test Sermon', sermonType: 'sermon', collection: 'ordered', imageLink: 'https://cdn.example/7.pdf', transcriptionText: text, transcriptionStatus: 'complete' }] })
      .mockResolvedValueOnce({ rows: [{ id: 6, title: '6. Before' }, { id: 8, title: '8. After' }] });
    const res = await request(app).get('/sermons/details?id=7');
    expect(res.status).toBe(200);
    const ld = jsonLdOf(res.text);
    expect(ld['@graph'][0]['@type']).toBe('Article');
    const desc = metaContent(res.text, 'name', 'description');
    expect(desc.startsWith('In the beginning was the Word.')).toBe(true);
    expect(desc.length).toBeLessThanOrEqual(156);
    expect(metaContent(res.text, 'property', 'og:description')).toBe(desc);
    expect(metaContent(res.text, 'property', 'og:title')).toBe("7. A Test Sermon | Samuel's Sermons");
    expect(res.text).toContain('href="/sermons/details?id=6" rel="prev"');
    expect(res.text).toContain('href="/sermons/details?id=8" rel="next"');
  });

  test('titles cannot break out of the JSON-LD script', () => {
    const out = seo.jsonForScript({ name: '</script><script>alert(1)</script>' });
    expect(out).not.toContain('</script>');
    expect(JSON.parse(out).name).toBe('</script><script>alert(1)</script>');
  });
});

describe('sermon list and detail links', () => {
  test('/sermons server-renders title links for every sermon', async () => {
    const res = await request(app).get('/sermons');
    expect(res.text).toContain('<a class="sermon-card__link" href="/sermons/details?id=1">Christ Above All</a>');
  });

  test('sermon page links back to the list and to the next sermon', async () => {
    const res = await request(app).get('/sermons/details?id=1');
    expect(res.text).toContain('href="/sermons"');
    expect(res.text).toContain('href="/sermons/details?id=2" rel="next"');
    expect(res.text).not.toContain('rel="prev"');
  });
});

describe('404s', () => {
  test.each(['/sermons/details?id=99999', '/sermons/details?id=abc', '/sermons/details', '/no-such-page'])(
    '%s is a real 404 with a helpful, noindexed page',
    async (url) => {
      const res = await request(app).get(url);
      expect(res.status).toBe(404);
      expect(res.text).toContain('Page Not Found');
      expect(res.text).toContain('href="/sermons"');
      expect(res.text).toContain('<meta name="robots" content="noindex">');
      expect(canonicalOf(res.text)).toBeNull();
    }
  );
});

describe('account pages are noindex', () => {
  test.each(['/auth/login', '/bookmarks'])('%s', async (url) => {
    const res = await request(app).get(url);
    expect(res.status).toBe(200);
    expect(res.text).toContain('<meta name="robots" content="noindex">');
    expect(res.headers['x-robots-tag']).toBe('noindex');
    expect(canonicalOf(res.text)).toBeNull();
    expect(jsonLdOf(res.text)).toBeNull();
  });

  test.each(['/profile', '/auth/change-password', '/admin', '/issues/mine'])('%s (login redirect) sends X-Robots-Tag', async (url) => {
    const res = await request(app).get(url);
    expect(res.status).toBe(302);
    expect(res.headers['x-robots-tag']).toBe('noindex');
  });
});

describe('head tags', () => {
  test('RSS feed, apple-touch-icon and Twitter tags are present', async () => {
    const res = await request(app).get('/sermons');
    expect(res.text).toContain('<link rel="alternate" type="application/rss+xml"');
    expect(res.text).toContain('<link rel="apple-touch-icon" href="/apple-touch-icon.png">');
    expect(metaContent(res.text, 'name', 'twitter:title')).toBe("Sermons | Samuel's Sermons");
  });

  test('apple-touch-icon is served with a long cache', async () => {
    const res = await request(app).get('/apple-touch-icon.png');
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('public, max-age=2592000');
  });
});

describe('sitemap', () => {
  test('lists only public URLs on the apex, with lastmod', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 1, updated_at: '2026-10-01T12:00:00Z' }, { id: 2, updated_at: null }] });
    const res = await request(app).get('/sitemap.xml');
    expect(res.status).toBe(200);
    const locs = Array.from(res.text.matchAll(/<loc>([^<]+)<\/loc>/g)).map((m) => m[1]);
    expect(locs).toContain(SITE + '/sermons/details?id=1');
    locs.forEach((loc) => {
      expect(loc.startsWith(SITE + '/')).toBe(true);
      expect(seo.isNoindexPath(new URL(loc).pathname)).toBe(false);
    });
    expect(res.text).toContain('<lastmod>2026-10-01</lastmod>');
  });
});
