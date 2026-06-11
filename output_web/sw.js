const CACHE_NAME = "russian-output-practice-v20260611-pwa2";
const CORE_ASSETS = [
  "./",
  "index.html",
  "styles.css?v=20260611-pwa2",
  "app.js?v=20260611-pwa2",
  "practice.js",
  "manifest.webmanifest",
  "offline.html",
  "data/practice.json",
  "icons/icon.svg",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "audio/001.mp3",
  "audio/002.mp3",
  "audio/003.mp3",
  "audio/004.mp3",
  "audio/005.mp3",
  "audio/006.mp3",
  "audio/007.mp3",
  "audio/008.mp3",
  "audio/009.mp3",
  "audio/010.mp3",
  "audio/011.mp3",
  "audio/012.mp3",
  "audio/013.mp3",
  "audio/014.mp3",
  "audio/015.mp3",
  "audio/016.mp3",
  "audio/017.mp3",
  "audio/018.mp3",
  "audio/019.mp3",
  "audio/020.mp3"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        Promise.all(CORE_ASSETS.map((asset) => cache.add(asset).catch(() => undefined))),
      ),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => {
          if (event.request.mode === "navigate") {
            return caches.match("offline.html");
          }
          return undefined;
        });
    }),
  );
});
