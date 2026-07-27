// Kempt Service Worker — offline shell + task completion queue
// Bump CACHE_NAME on any change here so old caches are evicted on activate.
const CACHE_NAME = 'kempt-v2';

// Only pre-cache things that are safe to serve stale.
// Authenticated HTML is deliberately NOT pre-cached.
const PRECACHE = [
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE))
      .catch(() => {})   // a missing asset must never block activation
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

function isCacheable(res) {
  // Never cache partial, opaque, redirected or error responses —
  // putting these in the cache is what produces broken offline pages.
  return res &&
    res.ok &&
    res.status === 200 &&
    !res.redirected &&
    res.type !== 'opaque' &&
    res.type !== 'opaqueredirect';
}

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only handle GET. POST/PATCH must always hit the network.
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch { return; }

  // Same-origin only — don't touch Supabase, Stripe or analytics traffic.
  if (url.origin !== self.location.origin) return;

  // Never intercept API, auth or Next.js data/HMR routes.
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/auth/') ||
    url.pathname.startsWith('/_next/webpack-hmr') ||
    url.searchParams.has('_rsc')
  ) return;

  // Navigation: network first, fall back to cache only when offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(res => {
          // Clone BEFORE the response is returned — cloning inside a later
          // .then() races the browser consuming the body and throws
          // "Response body is already used".
          if (isCacheable(res)) {
            const copy = res.clone();
            event.waitUntil(
              caches.open(CACHE_NAME).then(c => c.put(req, copy)).catch(() => {})
            );
          }
          return res;
        })
        .catch(async () => (await caches.match(req)) ?? Response.error())
    );
    return;
  }

  // Immutable build output: cache first, it can never go stale.
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(req).then(cached => cached ?? fetch(req).then(res => {
        if (isCacheable(res)) {
          const copy = res.clone();
          event.waitUntil(
            caches.open(CACHE_NAME).then(c => c.put(req, copy)).catch(() => {})
          );
        }
        return res;
      }))
    );
    return;
  }

  // Other static assets: stale-while-revalidate.
  if (['style', 'image', 'font', 'script'].includes(req.destination)) {
    event.respondWith(
      caches.match(req).then(cached => {
        const network = fetch(req).then(res => {
          if (isCacheable(res)) {
            const copy = res.clone();
            event.waitUntil(
              caches.open(CACHE_NAME).then(c => c.put(req, copy)).catch(() => {})
            );
          }
          return res;
        }).catch(() => cached);
        return cached ?? network;
      })
    );
  }
});

// Background sync — replay offline task completions when back online
self.addEventListener('sync', (event) => {
  if (event.tag === 'task-queue') event.waitUntil(replayQueue());
});

async function replayQueue() {
  let db;
  try { db = await openDB(); } catch { return; }

  let queue = [];
  try { queue = await getQueue(db); } catch { return; }

  for (const item of queue) {
    try {
      const res = await fetch('/api/offline/task-complete', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(item),
      });
      // Drop the item on success, and also on a 4xx — a permanently
      // rejected completion would otherwise retry forever.
      if (res.ok || (res.status >= 400 && res.status < 500)) {
        await removeFromQueue(db, item.id);
      }
    } catch {
      // Still offline — stop and wait for the next sync event
      break;
    }
  }
}

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('kempt-offline', 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains('queue')) {
        req.result.createObjectStore('queue', { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

function getQueue(db) {
  return new Promise((resolve, reject) => {
    const tx  = db.transaction('queue', 'readonly');
    const req = tx.objectStore('queue').getAll();
    req.onsuccess = () => resolve(req.result ?? []);
    req.onerror   = () => reject(req.error);
  });
}

function removeFromQueue(db, id) {
  return new Promise((resolve, reject) => {
    const tx  = db.transaction('queue', 'readwrite');
    const req = tx.objectStore('queue').delete(id);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}
