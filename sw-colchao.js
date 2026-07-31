// Service Worker do BSA Colchão — guarda o app em cache para funcionar sem internet.
// Só busca conteúdo novo quando o usuário toca em "Atualizar" no BSA APP (Hub) ou em "Verificar atualização" aqui.
var CACHE_NAME = 'bsa-colchao-cache-v1';
var PREFIX = 'bsa-colchao-cache-';

self.addEventListener('install', function(event) {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.add(new Request('bsa-treino-index.html', { cache: 'reload' })).catch(function() {});
    })
  );
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.filter(function(k) { return k.indexOf(PREFIX) === 0 && k !== CACHE_NAME; }).map(function(k) { return caches.delete(k); }));
    }).then(function() { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(event) {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then(function(cached) {
      if (cached) return cached;
      return fetch(event.request).then(function(resp) {
        var copy = resp.clone();
        caches.open(CACHE_NAME).then(function(cache) { cache.put(event.request, copy); });
        return resp;
      }).catch(function() { return cached; });
    })
  );
});
