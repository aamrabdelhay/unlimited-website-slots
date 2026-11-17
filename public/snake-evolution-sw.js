/* Wild Trails — Snake Evolution service worker.
 *
 * Registered with scope "/snake-evolution.html" so it controls only the game page and never the
 * rest of the site. It never touches localStorage / IndexedDB / cookies, so updating it cannot
 * affect saved coins or unlocked creatures.
 *
 * Strategy:
 *  - game page + local modules: network-first (new releases show up immediately), cache fallback offline
 *  - three.js from the pinned CDN URL: cache-first (versioned, immutable)
 *  - optional GLB model assets: stale-while-revalidate
 * Bump CACHE_VERSION only if the caching logic itself changes; game updates do not need it.
 */
const CACHE_VERSION = 'wt-pwa-v1';
const SHELL_CACHE = CACHE_VERSION + '-shell';
const RUNTIME_CACHE = CACHE_VERSION + '-runtime';
const MODEL_CACHE = CACHE_VERSION + '-models';

const GAME_URL = '/snake-evolution.html';
const THREE_BASE = 'https://cdn.jsdelivr.net/npm/three@0.180.0/';
const SHELL_URLS = [
  GAME_URL,
  '/wild-trails-art.mjs',
  '/snake-evolution-pwa/manifest.webmanifest',
  '/snake-evolution-pwa/icon-192.png',
  '/snake-evolution-pwa/icon-512.png',
  '/snake-evolution-pwa/apple-touch-icon.png'
];
const THREE_URLS = [
  THREE_BASE + 'build/three.module.js',
  THREE_BASE + 'build/three.core.js',
  THREE_BASE + 'examples/jsm/loaders/GLTFLoader.js',
  THREE_BASE + 'examples/jsm/utils/SkeletonUtils.js',
  THREE_BASE + 'examples/jsm/utils/BufferGeometryUtils.js'
];
const MODEL_HOSTS = ['gobkit.com'];
const MAX_MODEL_ENTRIES = 60;

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const shell = await caches.open(SHELL_CACHE);
    // One missing file must not block installation (the CDN may be unreachable on first visit).
    await Promise.allSettled(SHELL_URLS.map(url => shell.add(new Request(url, { cache: 'reload' }))));
    const runtime = await caches.open(RUNTIME_CACHE);
    await Promise.allSettled(THREE_URLS.map(url => runtime.add(new Request(url, { mode: 'cors' }))));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keep = new Set([SHELL_CACHE, RUNTIME_CACHE, MODEL_CACHE]);
    const names = await caches.keys();
    await Promise.all(names.filter(n => n.startsWith('wt-pwa-') && !keep.has(n)).map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

function cacheable(response) {
  return response && (response.ok || response.type === 'opaque');
}

async function networkFirst(request, cacheName, timeoutMs) {
  const cache = await caches.open(cacheName);
  try {
    const response = await new Promise((resolve, reject) => {
      const timer = timeoutMs ? setTimeout(() => reject(new Error('timeout')), timeoutMs) : 0;
      fetch(request).then(r => { clearTimeout(timer); resolve(r); }, e => { clearTimeout(timer); reject(e); });
    });
    if (cacheable(response) && response.type !== 'opaque') cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    throw error;
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (cacheable(response)) cache.put(request, response.clone());
  return response;
}

async function trimCache(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const refresh = fetch(request).then(response => {
    if (cacheable(response)) { cache.put(request, response.clone()); trimCache(cacheName, MAX_MODEL_ENTRIES); }
    return response;
  });
  if (cached) { refresh.catch(() => {}); return cached; }
  return refresh;
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.origin === self.location.origin) {
    const isGamePage = url.pathname === GAME_URL;
    const isGameAsset = url.pathname === '/wild-trails-art.mjs' || url.pathname.startsWith('/snake-evolution-pwa/');
    if (isGamePage || isGameAsset) event.respondWith(networkFirst(request, SHELL_CACHE, isGamePage ? 4000 : 0));
    return;
  }

  if (request.url.startsWith(THREE_BASE)) { event.respondWith(cacheFirst(request, RUNTIME_CACHE)); return; }
  if (MODEL_HOSTS.some(host => url.hostname === host || url.hostname.endsWith('.' + host))) {
    event.respondWith(staleWhileRevalidate(request, MODEL_CACHE));
  }
});
