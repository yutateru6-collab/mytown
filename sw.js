const CACHE = "mytown-civic-v32-politics-visual";
const STATIC_ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./review-fixes.css",
  "./politics.css",
  "./election-history.css",
  "./ui-v2.css",
  "./ui-home-v4.css",
  "./ui-home-v5.css",
  "./bulletin-reader.css",
  "./civic-actions.css",
  "./civic-portal.css",
  "./app.js",
  "./app-runtime.js",
  "./politics.js",
  "./election-history.js",
  "./ui-v2.js",
  "./ui-home-v4.js",
  "./bulletin-reader.js",
  "./civic-actions.js",
  "./civic-portal.js",
  "./manifest.webmanifest",
  "./icon.svg",
  "./assets/hero/nogata-watercolor.webp?v=13",
  "./assets/mascot/machinavi.webp?v=13",
  "./assets/icons/services.webp?v=13",
  "./assets/icons/deadline.webp?v=13",
  "./assets/icons/decision.webp?v=13",
  "./assets/illustrations/event-festival.svg?v=15",
  "./assets/illustrations/card-nearby.svg?v=16",
  "./assets/illustrations/card-deadline.svg?v=16",
  "./assets/illustrations/card-services.svg?v=16",
  "./assets/illustrations/card-decision.svg?v=16",
  "./assets/illustrations/card-bulletin.svg?v=17",
  "./assets/illustrations/civic-budget.webp?v=3",
  "./assets/illustrations/civic-bus.webp?v=3",
  "./assets/illustrations/civic-roadwork.webp?v=3",
  "./assets/illustrations/politics-mayor-person.webp?v=1",
  "./assets/illustrations/politics-council-people.webp?v=1",
  "./data/latest.json",
  "./data/community-events.json",
  "./data/community.json",
  "./data/changes.json",
  "./data/bulletin.json",
  "./data/politics.json",
  "./data/election-2023.json",
  "./data/civic-report-routes.json",
  "./data/civic-portal.json"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

async function networkFirst(request) {
  try {
    const response = await fetch(request, { cache: "no-store" });
    if (response.ok) {
      const copy = response.clone();
      const cache = await caches.open(CACHE);
      await cache.put(request, copy);
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request, { ignoreSearch: true });
    if (cached) return cached;
    throw error;
  }
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  const isSyncedData = url.pathname.endsWith("/data/latest.json") ||
    url.pathname.endsWith("/data/community-events.json") ||
    url.pathname.endsWith("/data/community.json") ||
    url.pathname.endsWith("/data/changes.json") ||
    url.pathname.endsWith("/data/bulletin.json") ||
    url.pathname.endsWith("/data/politics.json") ||
    url.pathname.endsWith("/data/election-2023.json") ||
    url.pathname.endsWith("/data/civic-report-routes.json") ||
    url.pathname.endsWith("/data/civic-portal.json");

  if (isSyncedData || event.request.mode === "navigate") {
    event.respondWith(networkFirst(event.request).catch(() => caches.match("./index.html")));
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        }
        return response;
      });
      return cached || network;
    })
  );
});
