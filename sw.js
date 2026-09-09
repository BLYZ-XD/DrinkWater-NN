/* 工作台 PWA Service Worker：离线缓存应用外壳 */
const VERSION = 'ww-v4';
const SHELL = [
  './',
  './index.html',
  './css/app.css',
  './js/store.js',
  './js/ui.js',
  './js/water.js',
  './js/home.js',
  './js/app.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== VERSION).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (url.origin !== location.origin) return;

  e.respondWith(
    caches.match(e.request).then(hit => {
      if (hit) return hit;
      return fetch(e.request).then(res => {
        const copy = res.clone();
        if (res.ok && (url.pathname.endsWith('.js') || url.pathname.endsWith('.css') ||
            url.pathname.endsWith('.png') || url.pathname.endsWith('.webmanifest') ||
            url.pathname.endsWith('.html') || url.pathname === '/')) {
          caches.open(VERSION).then(c => c.put(e.request, copy));
        }
        return res;
      });
    }).catch(() => caches.match('./index.html'))
  );
});
