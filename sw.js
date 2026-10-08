// ToniFlow - Service Worker
// v2: excluye explícitamente Firebase de la caché y usa "Network First" para el
// shell dinámico (index.html / script.js), así el dispositivo siempre intenta
// cargar la versión más reciente (con la conexión WebSocket a Firebase actualizada)
// antes de recurrir a la copia cacheada.
const CACHE_NAME = 'toniflow-cache-v2';

// Archivos que se sirven "cache first" (cambian poco: estilos, manifest, íconos)
const STATIC_SHELL = [
  './style.css',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// Archivos que se sirven "network first" (necesitan estar siempre actualizados)
const DYNAMIC_SHELL = [
  './',
  './index.html',
  './script.js'
];

// Dominios de Firebase que NUNCA deben pasar por el Service Worker.
// Esto evita que se intercepten o cacheen las conexiones WebSocket/long-polling
// de Realtime Database, lo que rompería la sincronización en tiempo real.
const FIREBASE_HOSTS = [
  'firebaseio.com',
  'firebaseapp.com',
  'gstatic.com',
  'googleapis.com'
];

function isFirebaseRequest(url) {
  return FIREBASE_HOSTS.some((host) => url.hostname.endsWith(host));
}

// Determina si la petición corresponde al shell "dinámico" (index.html / script.js / raíz)
function isDynamicRequest(url) {
  return (
    url.origin === self.location.origin &&
    (url.pathname === '/' ||
      url.pathname.endsWith('/') ||
      url.pathname.endsWith('/index.html') ||
      url.pathname.endsWith('/script.js'))
  );
}

// Instalación: se cachea el shell básico de la app
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll([...STATIC_SHELL, ...DYNAMIC_SHELL]))
  );
  self.skipWaiting();
});

// Activación: se eliminan versiones de caché anteriores (cuando cambie CACHE_NAME)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1) Nunca interceptar Firebase (dominio explícito, además del chequeo de origen):
  //    se deja pasar directo a la red, sin caché, para no romper la sincronización en tiempo real.
  if (isFirebaseRequest(url) || url.origin !== self.location.origin) {
    return;
  }

  // Solo interceptamos GET; el resto pasa directo a la red.
  if (request.method !== 'GET') {
    return;
  }

  if (isDynamicRequest(url)) {
    // 2) Network First para index.html y script.js: siempre se intenta traer la
    //    versión más nueva del servidor primero; si no hay conexión, se usa la caché.
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          return networkResponse;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match('./index.html')))
    );
    return;
  }

  // 3) Cache First para el resto del shell estático (estilos, manifest, íconos).
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;

      return fetch(request).then((networkResponse) => {
        const responseClone = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
        return networkResponse;
      });
    })
  );
});
