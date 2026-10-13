/* VoteConnect service worker: сначала сеть (всегда свежая версия), при отсутствии сети — кэш. */
const CACHE = "voteconnect-v9";
const CORE = ["./", "index.html", "app.html", "assets/css/style.css", "assets/css/fonts.css", "assets/fonts/onest-cyrillic.woff2", "assets/avatars/list.js", "assets/js/sanitize.js", "assets/js/icons.js", "assets/js/data.js", "assets/js/app.js", "manifest.webmanifest", "assets/icons/icon-192.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  if (!e.request.url.startsWith(self.location.origin)) return;   // чужие запросы не перехватываем и не кэшируем
  e.respondWith(
    fetch(e.request).then((res) => {
      if (res.ok) {
        // Ключ кэша — адрес без параметров: ?addr=… (адрес жителя) и ?demo=1 не должны оседать в кэше браузера.
        const key = new URL(e.request.url); key.search = ""; key.hash = "";
        const copy = res.clone(); caches.open(CACHE).then((c) => c.put(key.href, copy));
      }
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
