const CACHE_NAME = 'moob-caixa-v3';

// Assets to pre-cache on install — only resources guaranteed to exist
const PRECACHE_ASSETS = [
  '/',
  '/manifest.json'
];

// Install: pre-cache core assets individually (graceful — one failure won't abort install)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.allSettled(
        PRECACHE_ASSETS.map(url =>
          cache.add(url).catch(err => console.warn('[SW] Falha ao cachear:', url, err))
        )
      );
      console.log('[SW] Instalado e pre-cache concluído.');
    }).then(() => self.skipWaiting())
  );
});

// Activate: limpa caches antigas e assume controle imediato
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => {
            console.log('[SW] Removendo cache antiga:', name);
            return caches.delete(name);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch: Network-First com fallback para cache
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Passa direto para a rede: requisições não-GET, API, chrome-extension, etc.
  if (
    event.request.method !== 'GET' ||
    url.pathname.startsWith('/moob-api/') ||
    url.protocol === 'chrome-extension:'
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Atualiza cache para respostas bem-sucedidas da mesma origem
        if (
          networkResponse &&
          networkResponse.status === 200 &&
          (networkResponse.type === 'basic' || networkResponse.type === 'cors')
        ) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // Offline: tenta o cache
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          // Navegação sem rede: entrega o shell da SPA
          if (event.request.mode === 'navigate') {
            return caches.match('/');
          }
        });
      })
  );
});
