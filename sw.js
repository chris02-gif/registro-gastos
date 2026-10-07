// Service worker: guarda la app en caché para que abra al instante y sin conexión.
// Estrategia "stale-while-revalidate": se sirve la copia en caché y, en segundo plano,
// se descarga la versión publicada; los cambios aparecen la siguiente vez que se abre.
// Las cachés son compartidas por todo el dominio (p. ej. con otras apps en *.github.io),
// así que solo se tocan las que empiezan por este prefijo.
const CACHE_PREFIX = 'gastos-';
const CACHE = `${CACHE_PREFIX}v1`;
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k.startsWith(CACHE_PREFIX) && k !== CACHE).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  const network = fetch(request).then(async (response) => {
    if (response.ok && !response.redirected) {
      const cache = await caches.open(CACHE);
      await cache.put(request, response.clone());
    }
    return response;
  });

  event.waitUntil(network.catch(() => {}));
  event.respondWith(
    caches.open(CACHE)
      .then((cache) => cache.match(request, { ignoreSearch: true }))
      .then((cached) => cached || network)
  );
});
