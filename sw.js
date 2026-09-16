// Service Worker do BSA APP (Hub) — guarda todas as telas em cache para funcionar sem internet.
// Só busca conteúdo novo quando o usuário toca em "Atualizar" no cabeçalho.
var CACHE_NAME = 'bsa-hub-cache-v3';
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
    var link = (payload.fcmOptions && payload.fcmOptions.link) || (payload.data && payload.data.url) || 'index.html';
    var opcoes = {
      body: (payload.notification && payload.notification.body) || '',
      icon: 'icon-192.png',
      badge: 'icon-192.png',
      data: { url: link }
    };
    self.registration.showNotification(titulo, opcoes);
  });
} catch(e) { /* navegador sem suporte a push — segue só com o cache offline */ }

// Toque na notificação abre a tela certa (ex: o app de tarefas de quem recebeu o lembrete),
// forçando a navegação mesmo se o app já estiver aberto numa outra tela (ex: o app foi
// instalado na tela de início com atalho que abre direto no microfone) — o iOS às vezes
// ignora um simples focus() e mantém a tela antiga aberta.
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  var url = (event.notification.data && event.notification.data.url) || 'index.html';
  var fullUrl = new URL(url, self.location.href).href;
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(list) {
      if (list.length > 0 && 'navigate' in list[0]) {
        return list[0].navigate(fullUrl).then(function(c) {
          return c ? c.focus() : clients.openWindow(fullUrl);
        }).catch(function() { return clients.openWindow(fullUrl); });
      }
      return clients.openWindow(fullUrl);
    })
  );
});

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

// Verifica se a requisição é de algo que o Presença precisa ter salvo pra funcionar
// de verdade offline: os modelos e a biblioteca de reconhecimento facial (jsdelivr),
// as bibliotecas do Firebase (gstatic) e os sons (arquivo .wav do próprio site).
function ehArquivoEssencialExterno(url) {
  if (url.hostname === 'cdn.jsdelivr.net' && (url.pathname.indexOf('face-api.js') !== -1 || url.pathname.indexOf('/weights/') !== -1)) return true;
  if (url.hostname === 'www.gstatic.com' && url.pathname.indexOf('/firebasejs/') !== -1) return true;
  if (url.pathname.indexOf('.wav') !== -1) return true;
  return false;
}

self.addEventListener('fetch', function(event) {
  if (event.request.method !== 'GET') return;
  var url = new URL(event.request.url);
  var path = url.pathname.split('/').pop();
  var ehArquivoDoHub = FILES.indexOf(path) !== -1;
  var ehEssencialExterno = ehArquivoEssencialExterno(url);
  // só usa cache para os arquivos do Hub, os modelos/lib/sons/firebase essenciais;
  // qualquer outra requisição (dados do Firestore, apps pessoais de tarefas, etc.) sempre busca da rede.
  if (!ehArquivoDoHub && !ehEssencialExterno) return;
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
