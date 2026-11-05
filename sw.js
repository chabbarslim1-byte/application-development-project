/**
 * Riwaq Service Worker (عامل الخدمة لتطبيق رواق)
 * يوفر العمل بدون اتصال بالإنترنت (Offline First) وتخزين الأصول محلياً.
 */

const CACHE_NAME = "riwaq-cache-v1";
const ASSETS_TO_CACHE = [
  "./",
  "./index.html",
  "./css/style.css",
  "./js/data.js",
  "./js/player.js",
  "./js/app.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon.svg"
];

// مرحلة التثبيت: حفظ الأصول في الذاكرة المؤقتة
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[Riwaq SW] تخزين الأصول الأساسية في الذاكرة المؤقتة...");
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.warn("[Riwaq SW] فشل تخزين بعض الأصول غير الحرجة:", err);
      });
    }).then(() => self.skipWaiting())
  );
});

// مرحلة التنشيط: حذف الكاش القديم
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            console.log("[Riwaq SW] إزالة كاش قديم:", key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// مرحلة الاستجابة للطلبات: Cache First مع الاسترجاع من الشبكة
self.addEventListener("fetch", (event) => {
  // تجاهل الطلبات غير المدعومة مثل chrome-extension
  if (!event.request.url.startsWith("http")) return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request)
        .then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== "basic") {
            return networkResponse;
          }
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
          return networkResponse;
        })
        .catch(() => {
          // إذا كان الطلب للصفحة الرئيسية ولم يتوفر اتصال
          if (event.request.mode === "navigate") {
            return caches.match("./index.html");
          }
        });
    })
  );
});
