const CACHE = 'reclear-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Don't intercept cross-origin requests — let the browser handle API calls
  // natively so cookies, CORS, and SSE all work without interference.
  if (url.origin !== self.location.origin) return;

  // Cache-first for immutable Next.js static chunks (content-hashed filenames)
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(res => {
          if (res.ok) {
            const clone = res.clone(); // clone before any async work
            caches.open(CACHE).then(c => c.put(request, clone));
          }
          return res;
        });
      })
    );
    return;
  }

  // Network-first for navigation — offline fallback to cached root shell
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match('/').then(cached =>
          cached || new Response('Offline', { headers: { 'Content-Type': 'text/plain' } })
        )
      )
    );
    return;
  }

  // Network with cache fallback for all other same-origin requests
  event.respondWith(
    fetch(request)
      .then(res => {
        if (res.ok) {
          const clone = res.clone(); // clone before any async work
          caches.open(CACHE).then(c => c.put(request, clone));
        }
        return res;
      })
      .catch(() => caches.match(request))
  );
});
