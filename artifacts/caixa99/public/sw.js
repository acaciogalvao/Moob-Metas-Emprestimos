const CACHE_NAME = 'moob-caixa-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg',
  '/icon.jpg'
];

// Install event: cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching static assets');
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// Activate event: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] Clearing old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event: Network-First with Cache Fallback strategy
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Skip caching for non-GET requests or backend API requests
  if (event.request.method !== 'GET' || url.pathname.startsWith('/moob-api/')) {
    return; // Let the browser handle these normally via the network
  }

  // Network-First strategy: try the network first.
  // If it succeeds, update the cache and return the response.
  // If it fails (e.g. offline), fall back to the cache.
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // If the request was successful (status 200 or 304) and is a basic type, cache it
        if (networkResponse && (networkResponse.status === 200 || networkResponse.status === 304) && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // Fallback to cache if network fails (offline)
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // If the request is for page navigation, fall back to the root '/'
          if (event.request.mode === 'navigate') {
            return caches.match('/');
          }
        });
      })
  );
});
