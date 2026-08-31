const CACHE = "qingdan-shell-v7";
const ASSETS = ["./", "./index.html", "./styles.css", "./src/core.mjs", "./src/cloud-sync.js", "./src/release-config.js", "./src/app.js", "./vendor/supabase.js", "./manifest.webmanifest", "./assets/qingdan-icon.svg", "./assets/qingdan-icon-192.png", "./assets/qingdan-icon-512.png"];

self.addEventListener("install", event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())));
self.addEventListener("activate", event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  event.respondWith(fetch(event.request).then(response => {
    const copy = response.clone();
    caches.open(CACHE).then(cache => cache.put(event.request, copy));
    return response;
  }).catch(() => caches.match(event.request).then(hit => hit || caches.match("./index.html"))));
});
