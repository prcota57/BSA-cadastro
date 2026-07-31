// Service Worker do BSA APP (Hub) — guarda todas as telas em cache para funcionar sem internet.
// Só busca conteúdo novo quando o usuário toca em "Atualizar" no cabeçalho.
var CACHE_NAME = 'bsa-hub-cache-v1';
var PREFIX = 'bsa-hub-cache-';
var FILES = ['index.html', 'bsa-avaliacao.html', 'bsa-backup.html', 'bsa-cadastro.html', 'bsa-captacao.html', 'bsa-descritores.html', 'bsa-estoque.html', 'bsa-financas.html', 'bsa-mensageiro.html', 'bsa-presenca.html', 'bsa-relatorios.html', 'bsa-treino-index.html'];

self.addEventListener('install', function(event) {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return Promise.all(FILES.map(function(f) {
        return cache.add(new Request(f, { cache: 'reload' })).catch(function() {});
      }));
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
