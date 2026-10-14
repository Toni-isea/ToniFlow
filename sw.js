// ToniFlow - Service Worker (PWA instalable + soporte offline)
//
// - install: precachea el shell de la app. Cada archivo se cachea por separado y un fallo
//   puntual NO aborta la instalación del Service Worker (con cache.addAll, un solo 404 en
//   cualquier archivo hacía fallar todo el "install" y Chrome dejaba de ofrecer "Instalar").
// - fetch: siempre responde a las páginas (navegación) y archivos de la app; Firebase y
//   cualquier otro origen se dejan pasar directo a la red.
const CACHE_NAME = 'toniflow-cache-v3';

const PRECACHE_URLS = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png'
];

// Dominios de Firebase que NUNCA deben pasar por el Service Worker
// (se romperían las conexiones en tiempo real de Realtime Database).
const FIREBASE_HOSTS = ['firebaseio.com', 'firebaseapp.com', 'gstatic.com', 'googleapis.com'];

function isFirebaseRequest(url) {
  return FIREBASE_HOSTS.some((host) => url.hostname.endsWith(host));
}

// Archivos que deben estar siempre actualizados: se piden primero a la red
function isDynamicRequest(url) {
  return url.pathname.endsWith('/index.html') || url.pathname.endsWith('/script.js');
}

// ---------- install ----------
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(
        PRECACHE_URLS.map((url) =>
          // cache: 'reload' evita guardar una copia vieja del caché HTTP de GitHub Pages
          cache.add(new Request(url, { cache: 'reload' })).catch((err) => {
            console.warn('[SW] No se pudo precachear', url, err);
          })
        )
      )
    )
  );
  self.skipWaiting();
});

// ---------- activate ----------
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

// Red primero; si falla (sin conexión), copia en caché; como último recurso, el index.html cacheado
async function networkFirst(request, fallbackUrl) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (err) {
    const cached = await caches.match(request, { ignoreSearch: true });
    if (cached) return cached;
    if (fallbackUrl) {
      const fallback = await caches.match(fallbackUrl);
      if (fallback) return fallback;
    }
    return new Response('Sin conexión', { status: 503, statusText: 'Offline' });
  }
}

// Caché primero; si no está, red (y se guarda para la próxima)
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const networkResponse = await fetch(request);
  if (networkResponse && networkResponse.ok) {
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, networkResponse.clone());
  }
  return networkResponse;
}

// ---------- fetch ----------
self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Firebase y cualquier otro origen: directo a la red, sin tocar
  if (isFirebaseRequest(url) || url.origin !== self.location.origin) return;

  // Abrir la app (navegación, incluida la start_url): funciona también sin conexión
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, './index.html'));
    return;
  }

  if (isDynamicRequest(url)) {
    event.respondWith(networkFirst(request));
    return;
  }

  event.respondWith(cacheFirst(request));
});
