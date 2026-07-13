/* sw.js - Service Worker with CDN caching */
var CACHE_NAME = 'vocab-app-v2';
var ASSETS = [
  './',
  'index.html',
  'css/style.css',
  'js/storage.js',
  'js/ocr.js',
  'js/review.js',
  'js/dict.js',
  'js/app.js',
  'manifest.json',
  // Tesseract.js CDN files (cached for offline/fast reload)
  'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js',
  'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.0/tesseract-core.wasm.js',
  'https://cdn.jsdelivr.net/npm/tesseract.js-data-eng@4.0.0/eng.traineddata'
];

// Install - cache all assets
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      // Cache local assets eagerly
      return cache.addAll(ASSETS).catch(function(err) {
        console.log('SW: some assets failed to cache, will retry on fetch', err);
      });
    })
  );
  // Activate immediately
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

// Fetch - cache-first for local, network-first for CDN
self.addEventListener('fetch', function(event) {
  var url = event.request.url;

  // For CDN resources (Tesseract.js), use cache-first strategy
  if (url.includes('cdn.jsdelivr.net') || url.includes('unpkg.com')) {
    event.respondWith(
      caches.match(event.request).then(function(cached) {
        if (cached) return cached;
        return fetch(event.request).then(function(response) {
          if (response && response.status === 200) {
            var clone = response.clone();
            caches.open(CACHE_NAME).then(function(cache) {
              cache.put(event.request, clone);
            });
          }
          return response;
        }).catch(function() {
          // Offline - return cached if available
          return cached || new Response('Network error', { status: 408 });
        });
      })
    );
    return;
  }

  // For local assets, use cache-first with network fallback
  event.respondWith(
    caches.match(event.request).then(function(cached) {
      if (cached) {
        // Return cached immediately, update cache in background
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