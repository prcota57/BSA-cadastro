// Service Worker do BSA APP (Hub) — guarda todas as telas em cache para funcionar sem internet.
// Só busca conteúdo novo quando o usuário toca em "Atualizar" no cabeçalho.
var CACHE_NAME = 'bsa-hub-cache-v2';
var PREFIX = 'bsa-hub-cache-';
var FILES = ['index.html', 'bsa-avaliacao.html', 'bsa-backup.html', 'bsa-cadastro.html', 'bsa-captacao.html', 'bsa-descritores.html', 'bsa-diretora.html', 'bsa-estoque.html', 'bsa-financas.html', 'bsa-mensageiro.html', 'bsa-presenca.html', 'bsa-relatorios.html', 'bsa-tarefas.html', 'bsa-treino-index.html'];

// ---------- NOTIFICAÇÕES (Firebase Cloud Messaging) ----------
try {
  importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');
  firebase.initializeApp({
    apiKey: "AIzaSyDmM2m_QnEeRflAKCyb11TzOrZM7iVgLCA",
    authDomain: "bsa-app-493c3.firebaseapp.com",
    projectId: "bsa-app-493c3",
    storageBucket: "bsa-app-493c3.firebasestorage.app",
    messagingSenderId: "455452879388",
    appId: "1:455452879388:web:7135d93c116b2fe7cfcdd9"
  });
  var messaging = firebase.messaging();
  messaging.onBackgroundMessage(function(payload){
    var titulo = (payload.notification && payload.notification.title) || '🔔 BSA';
    var opcoes = {
      body: (payload.notification && payload.notification.body) || '',
      icon: 'icon-192.png',
      badge: 'icon-192.png'
    };
    self.registration.showNotification(titulo, opcoes);
  });
} catch(e) { /* navegador sem suporte a push — segue só com o cache offline */ }

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
  var path = new URL(event.request.url).pathname.split('/').pop();
  // só usa cache para os arquivos do Hub listados em FILES;
  // qualquer outra página (como os apps pessoais de tarefas) sempre busca da rede.
  if (FILES.indexOf(path) === -1) return;
  event.respondWith(
    caches.match(event.request).then(function(cached) {
      if (cached) return cached;
      return fetch(event.request).then(function(resp) {
        var copy = resp.clone();
        // Precisa do waitUntil aqui — sem ele, o navegador pode encerrar o Service Worker
        // antes do cache.put() terminar de salvar, principalmente quando muitos arquivos
        // (como os modelos de reconhecimento facial) chegam quase juntos.
        event.waitUntil(
          caches.open(CACHE_NAME).then(function(cache) { return cache.put(event.request, copy); })
        );
        return resp;
      }).catch(function() { return cached; });
    })
  );
});
