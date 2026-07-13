/* sw.js - Service Worker for PWA offline support */
var CACHE_NAME = 'vocab-app-v3';
// Only cache local assets eagerly - CDN files are large and cached lazily
var ASSETS = [
  './',
  'index.html',
  'css/style.css',
  'js/storage.js',
  'js/ocr.js',
  'js/review.js',
  'js/dict.js',
  'js/app.js',
  'manifest.json'
];

// Install - cache local assets only
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(ASSETS).catch(function(err) {
        console.log('SW: some assets failed to cache, will retry on fetch', err);
      });
    })
  );
  self.skipWaiting();
});

// Activate - clean old caches
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(names) {
      return Promise.all(
        names.filter(function(name) { return name !== CACHE_NAME; })
          .map(function(name) { return caches.delete(name); })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

// Fetch - stale-while-revalidate for CDN, network-first for local
self.addEventListener('fetch', function(event) {
  var url = event.request.url;

  // For CDN resources (Tesseract.js), use stale-while-revalidate
  if (url.includes('cdn.jsdelivr.net') || url.includes('unpkg.com')) {
    event.respondWith(
      caches.open(CACHE_NAME).then(function(cache) {
        return cache.match(event.request).then(function(cached) {
          var fetchPromise = fetch(event.request).then(function(response) {
            if (response && response.status === 200) {
              cache.put(event.request, response.clone());
            }
            return response;
          });
          // Return cached immediately, update in background
          return cached || fetchPromise;
        });
      })
    );
    return;
  }

  // For local assets, cache-first with network update
  event.respondWith(
    caches.match(event.request).then(function(cached) {
      if (cached) {
        // Update cache in background
        fetch(event.request).then(function(response) {
          if (response && response.status === 200) {
            caches.open(CACHE_NAME).then(function(cache) {
              cache.put(event.request, response);
            });
          }
        }).catch(function() {});
        return cached;
      }
      return fetch(event.request).then(function(response) {
        if (response && response.status === 200) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, clone);
          });
        }
        return response;
      });
    })
  );
});