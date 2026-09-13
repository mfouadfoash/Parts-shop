// ⚠️ مهم جدًا: في كل مرة بترفع تحديث جديد للتطبيق، غيّر رقم النسخة دي (CACHE_VERSION)
// عشان الموبايل يعرف إن فيه نسخة جديدة وينزّلها بدل ما يفضل يستخدم القديمة المخزّنة عنده.
const CACHE_VERSION = 'v4'; // ← غيّر الرقم ده (v5, v6, ...) مع كل تحديث مستقبلي
const CACHE_NAME = 'parts-shop-cache-' + CACHE_VERSION;

// الملفات الأساسية لنفس الأصل (نفس الدومين) — دايمًا متاحة، المفروض التخزين بتاعها ينجح دايمًا
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];

// مكتبات خارجية من CDN لازمة لتصدير الإكسيل وطباعة الباركود — بدون تخزينها هنا، الميزتين دول
// هينهاروا فى أول استخدام بدون إنترنت رغم إن باقي التطبيق مصمم يشتغل أوفلاين بالكامل.
const EXTERNAL_LIBS = [
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jsbarcode/3.11.6/JsBarcode.all.min.js',
];

// عند تثبيت نسخة جديدة من الـ Service Worker: نخزّن الملفات الأساسية فورًا
// ونطلب من المتصفح إنه يفعّلها على طول من غير ما يستنى إغلاق كل التابات (skipWaiting)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // نخزّن شِل التطبيق الأساسي أولًا (addAll هنا آمن: كل الملفات دي من نفس الأصل ومتوقع نجاحها دايمًا)
      return cache.addAll(APP_SHELL).then(() =>
        // نخزّن كل مكتبة خارجية على حدة (مش addAll) عشان لو واحدة فشلت لأي سبب (مشكلة مؤقتة فى الـ CDN
        // وقت أول تثبيت مثلًا)، الفشل ده منعزل ومش بيلغي تثبيت باقي شِل التطبيق الأساسي المفروض يشتغل
        // أوفلاين بشكل مضمون فى كل الحالات.
        Promise.all(
          EXTERNAL_LIBS.map((url) =>
            cache.add(url).catch((err) => {
              console.warn('تعذر تخزين مكتبة خارجية أوفلاين وقت التثبيت (هيتم إعادة المحاولة أول ما تتاح فرصة اتصال):', url, err);
            })
          )
        )
      );
    })
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

  // باقي الملفات (زي المكتبات الخارجية لو احتجنا نجيب نسخة أحدث منها مستقبلًا، أو أي ملف تاني):
  // كاش أولًا، وبعدين الشبكة — ولو اتجابت من الشبكة، نخزّنها فعليًا فى الكاش عشان تشتغل أوفلاين من المرة
  // الجاية (ده كان ناقص قبل كده: كان بيقرا من الكاش بس من غير ما يكتب فيه أي حاجة جديدة أبدًا).
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((networkResponse) => {
        // networkResponse.ok مبيبقاش true للردود من مصدر خارجي بدون CORS كامل (opaque response، status=0)،
        // فبنسمح بتخزين أي رد نجح فعليًا (ok) أو رد "معتم" (opaque) طالما مفيش استثناء اتحصل أصلًا فى fetch نفسها.
        if (networkResponse && (networkResponse.ok || networkResponse.type === 'opaque')) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
        }
        return networkResponse;
      });
    })
  );
});
