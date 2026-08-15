const CACHE = 'nano-v3';
const STATIC = ['/manifest.json', '/apple-touch-icon.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(STATIC)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    const hadOld = keys.some(key => key !== CACHE);
    await Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
    if (hadOld) {
      const windows = await self.clients.matchAll({ type: 'window' });
      windows.forEach(client => client.postMessage({ type: 'NEW_VERSION' }));
    }
  })());
});

self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING' || event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/socket.io')) return;
  if (url.pathname === '/sw.js') return;

  const isNavigate =
    event.request.mode === 'navigate' ||
    url.pathname === '/' ||
    (event.request.headers.get('accept') || '').includes('text/html');

  if (isNavigate) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response && response.ok && url.pathname.startsWith('/assets/')) {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(event.request, copy));
        }
        return response;
      });
    })
  );
});
