/* Сначала сеть, при отсутствии сети — кэш VoteConnect. */
const CACHE = "voteconnect-v12";
const CORE = [
  "./", "index.html", "app.html", "investors.html", "privacy.html",
  "assets/css/style.css", "assets/css/site.css", "assets/css/fonts.css",
  "assets/fonts/onest-cyrillic-ext.woff2", "assets/fonts/onest-cyrillic.woff2",
  "assets/fonts/onest-latin-ext.woff2", "assets/fonts/onest-latin.woff2",
  "assets/js/theme.js", "assets/js/sanitize.js", "assets/js/data.js", "assets/js/app.js",
  "manifest.webmanifest", "assets/icons/icon-192.png", "assets/icons/apple-touch-icon.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((key) => key.startsWith("voteconnect-") && key !== CACHE).map((key) => caches.delete(key))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const key = new URL(event.request.url);
  if (key.origin !== self.location.origin) return;

  key.search = "";
  key.hash = "";
  event.respondWith(
    fetch(event.request).then(async (response) => {
      if (response.ok) {
        const copy = response.clone();
        await caches.open(CACHE).then((cache) => cache.put(key.href, copy)).catch(() => {});
      }
      return response;
    }).catch(() => caches.match(key.href))
  );
});
