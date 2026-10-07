// Service worker: guarda la app en caché para que abra sin conexión.
// - La página (index.html): primero la red, para ver siempre la última versión publicada;
//   sin conexión, o si la red tarda más de NETWORK_TIMEOUT_MS, se usa la copia guardada.
// - El resto (iconos, manifiesto): primero la copia guardada y se actualiza en segundo plano.

// Las cachés son compartidas por todo el dominio (p. ej. con otras apps en *.github.io),
// así que solo se tocan las que empiezan por este prefijo.
const CACHE_PREFIX = 'gastos-';
const CACHE = `${CACHE_PREFIX}v1`;
const NETWORK_TIMEOUT_MS = 3000;
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

async function networkFirst(network, cached) {
  const timeout = new Promise((resolve) => setTimeout(resolve, NETWORK_TIMEOUT_MS));
  const fresh = await Promise.race([network.catch(() => null), timeout]);
  if (fresh && fresh.ok && !fresh.redirected) return fresh;
  return (await cached) || fresh || network;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  const isPage = request.mode === 'navigate';
  const cache = caches.open(CACHE);
  const network = cache.then((c) =>
    // La página se revalida siempre con el servidor (GitHub Pages la deja 10 min en la caché HTTP)
    (isPage ? fetch(request.url, { cache: 'no-cache', credentials: 'same-origin' }) : fetch(request)).then(async (response) => {
      if (response.ok && !response.redirected) await c.put(request, response.clone());
      return response;
    })
  );
  const cached = cache.then((c) => c.match(request, { ignoreSearch: true }));

  event.waitUntil(network.catch(() => {}));
  event.respondWith(
    isPage
      ? networkFirst(network, cached)
      : cached.then((response) => response || network)
  );
});
