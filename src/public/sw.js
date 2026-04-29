// Service Worker for offline mode
var CACHE_NAME = 'samuel-sermons-v1';
var STATIC_ASSETS = [
  '/',
  '/sermons',
  '/about',
  '/bookmarks',
  '/stylesheets/index.css',
  '/javascripts/sermons.js',
  '/javascripts/share.js',
  '/javascripts/sermon-interactions.js',
  '/javascripts/bookmarks-page.js',
  '/images/samuel-starling-1.jpg',
  '/images/wv-hills.jpg',
  '/favicon.svg',
];

// Install: cache static assets
self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(
        names.filter(function (n) { return n !== CACHE_NAME; })
          .map(function (n) { return caches.delete(n); })
      );
    })
  );
  self.clients.claim();
});

// Fetch: network first, fall back to cache
self.addEventListener('fetch', function (e) {
  // Skip non-GET and API requests
  if (e.request.method !== 'GET') return;
  if (e.request.url.includes('/api/')) return;
  if (e.request.url.includes('/admin/transcribe/') && e.request.url.includes('/save')) return;

  e.respondWith(
    fetch(e.request).then(function (response) {
      // Cache successful responses
      if (response.ok) {
        var clone = response.clone();
        caches.open(CACHE_NAME).then(function (cache) {
          cache.put(e.request, clone);
        });
      }
      return response;
    }).catch(function () {
      // Network failed, try cache
      return caches.match(e.request).then(function (cached) {
        return cached || new Response('Offline — this page is not cached yet.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain' },
        });
      });
    })
  );
});
