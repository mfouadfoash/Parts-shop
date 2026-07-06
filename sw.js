// ══════════════════════════════════════════════════════════
// Service Worker — يخلي التطبيق يشتغل حتى من غير إنترنت
// بعد أول فتح ناجح، بيتم تخزين نسخة من التطبيق محليًا،
// وأي مرة يبقى فيه نت، بيتحدث الكاش تلقائيًا بآخر نسخة.
// ══════════════════════════════════════════════════════════

const CACHE_NAME = 'parts-shop-cache-v1';
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
];

// عند التثبيت: حمّل الملفات الأساسية في الكاش
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .catch((err) => console.error('فشل تخزين الملفات الأساسية:', err))
  );
  self.skipWaiting();
});

// عند التفعيل: احذف أي نسخ كاش قديمة
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

// عند كل طلب: جرّب الإنترنت أولًا (عشان تاخد آخر تحديث)، ولو مفيش نت اخدم من الكاش
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  event.respondWith(
    fetch(req)
      .then((networkRes) => {
        const resClone = networkRes.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone)).catch(() => {});
        return networkRes;
      })
      .catch(() =>
        caches.match(req).then((cached) => cached || caches.match('./index.html'))
      )
  );
});
