/* ============================================================
 * خَلّد — Service Worker v2.1
 * استراتيجية: cache-first للملفات الثابتة، network-first للـ API
 * ============================================================ */
'use strict';

const CACHE_NAME    = 'khallad-v3';
const STATIC_ASSETS = [
  './',
  './app.js',
  './questions.js',
  './games.js',
  './games2.js',
  './manifest.json',
];

// ─── التثبيت: خزّن الملفات الأساسية ─────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS).catch(err => {
        console.warn('[SW] Pre-cache failed (some assets may not exist yet):', err);
      });
    })
  );
  self.skipWaiting();
});

// ─── التفعيل: احذف الكاشات القديمة ──────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ─── Fetch: توجيه الطلبات ────────────────────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // API calls → Network first, no cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkOnly(event.request));
    return;
  }

  // WebSocket → تجاهل
  if (event.request.url.startsWith('ws://') || event.request.url.startsWith('wss://')) return;

  // الملفات الثابتة الكبيرة (questions.js, games.js) → Cache first
  if (url.pathname.endsWith('.js') || url.pathname.endsWith('.css') || url.pathname.endsWith('.json')) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  // HTML → Stale-while-revalidate
  event.respondWith(staleWhileRevalidate(event.request));
});

// ─── استراتيجيات التخزين ─────────────────────────────────────
async function networkOnly(request) {
  try {
    return await fetch(request);
  } catch {
    return new Response(JSON.stringify({ error: 'لا يوجد اتصال بالإنترنت' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('الملف غير متاح في وضع عدم الاتصال', { status: 503 });
  }
}

async function staleWhileRevalidate(request) {
  const cache   = await caches.open(CACHE_NAME);
  const cached  = await cache.match(request);
  const fetchPromise = fetch(request).then(response => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => null);
  return cached || fetchPromise || new Response('غير متاح', { status: 503 });
}
