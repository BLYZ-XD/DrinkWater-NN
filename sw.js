/* 工作台 PWA Service Worker：网络优先 + 缓存兜底（保证更新即时生效、断网可用） */
const VERSION = 'ww-v6';
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
    // 1) 先走网络：拿到新文件就更新缓存（旧缓存不会再“卡住”新版本）
    fetch(e.request).then(res => {
      if (res && res.ok) {
        const copy = res.clone();
        caches.open(VERSION).then(c => c.put(e.request, copy));
      }
      return res;
    }).catch(() =>
      // 2) 断网时用缓存兜底
      caches.match(e.request).then(hit => {
        if (hit) return hit;
        // 导航请求兜底到首页
        return e.request.mode === 'navigate' ? caches.match('./index.html') : undefined;
      })
    )
  );
});
