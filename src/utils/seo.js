/**
 * Search-engine helpers: canonical URLs, robots rules and JSON-LD.
 *
 * Everything here is built from SITE_URL (default: the apex domain, since
 * www 301s to it) so canonical links, the sitemap, the RSS feed and the
 * structured data all agree on one host.
 */

var DEFAULT_SITE_URL = 'https://samuelsermons.com';
var SITE_NAME = "Samuel's Sermons";
var DEFAULT_DESCRIPTION = "Home of Rev. Samuel Starling's Sermons created throughout his time in the Methodist Church.";

// Paths that are account-only, personal or not real content pages.
// They get <meta name="robots" content="noindex"> plus an X-Robots-Tag header
// (the header also covers redirects and JSON responses) and never a canonical.
var NOINDEX_PREFIXES = [
  '/auth',
  '/profile',
  '/admin',
  '/issues',
  '/api',
  '/birthday',
  // Saved sermons live in the visitor's own browser, so crawlers only ever see an empty shell.
  '/bookmarks',
  '/sermons/create',
  '/sermons/update',
  '/sermons/delete',
];

function siteUrl() {
  return (process.env.SITE_URL || DEFAULT_SITE_URL).replace(/\/+$/, '');
}

function absoluteUrl(path) {
  return siteUrl() + (path && path !== '/' ? path : '/');
}

function isNoindexPath(path) {
  return NOINDEX_PREFIXES.some(function (p) {
    return path === p || path.indexOf(p + '/') === 0;
  });
}

/**
 * Canonical URL for a request: no query string, no trailing slash, except the
 * sermon detail page whose identity is its ?id=N.
 */
function canonicalFor(req) {
  var path = req.path.length > 1 ? req.path.replace(/\/+$/, '') : '/';
  if (path === '/sermons/details') {
    var id = parseInt(req.query.id, 10);
    if (!isNaN(id) && id > 0) return absoluteUrl('/sermons/details?id=' + id);
    return null;
  }
  return absoluteUrl(path);
}

/**
 * Express middleware: sets res.locals.noindex and res.locals.canonicalUrl for
 * every rendered page. Error and 404 handlers clear them again.
 */
function seoLocals(req, res, next) {
  var noindex = isNoindexPath(req.path);
  res.locals.noindex = noindex;
  res.locals.canonicalUrl = noindex ? null : canonicalFor(req);
  if (noindex) res.set('X-Robots-Tag', 'noindex');
  next();
}

/** Mark the response as not indexable (404s, errors). */
function markNoindex(res) {
  res.locals.noindex = true;
  res.locals.canonicalUrl = null;
  res.set('X-Robots-Tag', 'noindex');
}

/**
 * Serialize data for an inline <script> (JSON-LD or app data). Escapes the
 * characters that could close the script element or start an HTML comment.
 */
function jsonForScript(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

/** Short plain-text summary for a meta description (~155 chars, cut on a word). */
function summarize(text, max) {
  max = max || 155;
  var clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  if (clean.length <= max) return clean;
  var cut = clean.slice(0, max);
  var lastSpace = cut.lastIndexOf(' ');
  if (lastSpace > max * 0.6) cut = cut.slice(0, lastSpace);
  return cut.replace(/[\s,;:.\-–—]+$/, '') + '…';
}

// Only facts stated on the About page.
function person() {
  return {
    '@type': 'Person',
    '@id': absoluteUrl('/about') + '#samuel-starling',
    name: 'Samuel Starling',
    honorificPrefix: 'Rev.',
    jobTitle: 'Minister',
    description: 'Methodist minister whose sermons, some dating back to the 1980s, are preserved on this site.',
    image: absoluteUrl('/images/samuel-starling-1.jpg'),
    url: absoluteUrl('/about'),
  };
}

function website() {
  return {
    '@type': 'WebSite',
    '@id': absoluteUrl('/') + '#website',
    name: SITE_NAME,
    url: absoluteUrl('/'),
    description: DEFAULT_DESCRIPTION,
    inLanguage: 'en-US',
  };
}

/** items: [{ name, url }] in order, Home first. */
function breadcrumbs(items) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map(function (item, i) {
      return { '@type': 'ListItem', position: i + 1, name: item.name, item: item.url };
    }),
  };
}

function withContext(nodes) {
  return { '@context': 'https://schema.org', '@graph': nodes };
}

function homeJsonLd() {
  return withContext([website(), person()]);
}

/** Home > <page>, for public pages that don't build their own graph. */
function pageJsonLd(pageTitle, canonicalUrl) {
  if (!pageTitle || !canonicalUrl) return null;
  return withContext([
    breadcrumbs([
      { name: 'Home', url: absoluteUrl('/') },
      { name: pageTitle, url: canonicalUrl },
    ]),
  ]);
}

/**
 * A sermon page: Article when the page shows the full transcription,
 * otherwise CreativeWork. No dates: the data has none for the sermon itself.
 */
function sermonJsonLd(sermon, displayTitle, description) {
  var url = absoluteUrl('/sermons/details?id=' + sermon.id);
  var work = {
    '@type': sermon.transcriptionText ? 'Article' : 'CreativeWork',
    '@id': url + '#sermon',
    name: displayTitle,
    url: url,
    author: { '@id': person()['@id'] },
    isPartOf: { '@id': website()['@id'] },
    inLanguage: 'en-US',
    description: description,
    isAccessibleForFree: true,
  };
  if (sermon.transcriptionText) work.headline = displayTitle;
  if (sermon.sermonType) work.genre = sermon.sermonType;
  if (sermon.imageLink) {
    work.associatedMedia = {
      '@type': 'MediaObject',
      contentUrl: sermon.imageLink,
      encodingFormat: 'application/pdf',
    };
  }
  return withContext([
    work,
    person(),
    breadcrumbs([
      { name: 'Home', url: absoluteUrl('/') },
      { name: 'Sermons', url: absoluteUrl('/sermons') },
      { name: displayTitle, url: url },
    ]),
  ]);
}

module.exports = {
  DEFAULT_DESCRIPTION: DEFAULT_DESCRIPTION,
  siteUrl: siteUrl,
  absoluteUrl: absoluteUrl,
  isNoindexPath: isNoindexPath,
  canonicalFor: canonicalFor,
  seoLocals: seoLocals,
  markNoindex: markNoindex,
  jsonForScript: jsonForScript,
  summarize: summarize,
  homeJsonLd: homeJsonLd,
  pageJsonLd: pageJsonLd,
  sermonJsonLd: sermonJsonLd,
};
