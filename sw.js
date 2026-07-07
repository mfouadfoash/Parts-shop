// ⚠️ مهم جدًا: في كل مرة بترفع تحديث جديد للتطبيق، غيّر رقم النسخة دي (CACHE_VERSION)
// عشان الموبايل يعرف إن فيه نسخة جديدة وينزّلها بدل ما يفضل يستخدم القديمة المخزّنة عنده.
const CACHE_VERSION = 'v3'; // ← غيّر الرقم ده (v4, v5, ...) مع كل تحديث مستقبلي
const CACHE_NAME = 'parts-shop-cache-' + CACHE_VERSION;

const APP_SHELL = [
  './',
  './index.html',
];

// عند تثبيت نسخة جديدة من الـ Service Worker: نخزّن الملفات الأساسية فورًا
// ونطلب من المتصفح إنه يفعّلها على طول من غير ما يستنى إغلاق كل التابات (skipWaiting)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// عند تفعيل النسخة الجديدة: نمسح أي كاش قديم بأي اسم مختلف عن النسخة الحالية
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// استراتيجية "الشبكة أولاً" لصفحة index.html: لو فيه نت، هات النسخة الجديدة دايمًا
// وحدّث الكاش بيها. لو مفيش نت، استخدم النسخة المخزّنة (للعمل بدون إنترنت).
self.addEventListener('fetch', (event) => {
  const req = event.request;

  if (req.mode === 'navigate' || req.url.endsWith('index.html') || req.url.endsWith('/')) {
    event.respondWith(
      fetch(req)
        .then((networkResponse) => {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          return networkResponse;
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match('./index.html')))
    );
    return;
  }

  // باقي الملفات (لو فيه أي ملفات ثابتة تانية): كاش أولاً، وبعدين الشبكة
  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req))
  );
});
