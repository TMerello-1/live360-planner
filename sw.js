// Offline-Unterstützung: App-Dateien vorab cachen, Seite "network first", Schriften "stale while revalidate"
const VERSION = "v11";
const APP = `planner-${VERSION}`;
const FONTS = "planner-fonts";
const ASSETS = ["./", "./index.html", "./manifest.webmanifest", "./pwa.js", "./updates.js", "./sync.js", "./vendor/qrcode.js", "./icons/icon-192.png", "./icons/icon-512.png", "./icons/apple-touch-icon.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(APP).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== APP && k !== FONTS).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(caches.open(FONTS).then(async c => {
      const hit = await c.match(req);
      const net = fetch(req).then(r => { c.put(req, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    }));
    return;
  }
  if (url.origin !== location.origin) return;
  if (url.pathname.includes("/data/")) return; // Programmdaten immer frisch aus dem Netz

  if (req.mode === "navigate") {
    e.respondWith(fetch(req)
      .then(r => { const copy = r.clone(); caches.open(APP).then(c => c.put("./index.html", copy)); return r; })
      .catch(() => caches.match("./index.html")));
    return;
  }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req)));
});
