// Bump this version for EVERY deployment changing a cached file, and update URLs
// below when adding/removing files or changing their query-string versions.
// Also version changed modules and their importers for browsers without a worker.
const CACHE_PREFIX = "frosty-dice-pwa-";
const CACHE_NAME = CACHE_PREFIX + "v18";
const APP_SHELL = "/index.html";
const PRECACHE_URLS = [
  APP_SHELL,
  "/manifest.webmanifest",
  "/css/style.css?v=frosty-dollar-1",
  "/js/app.js?v=protective-rules-1",
  "/js/challenge-note.js?v=frosty-dollar-1",
  "/js/board-state.js?v=v3-multipliers-1",
  "/js/game.js?v=protective-rules-1",
  "/js/scoring.js?v=v3-multipliers-1",
  "/js/storage.js?v=protective-rules-1",
  "/js/pwa.js",
  "/js/rules.js?v=additional-rules-1",
  "/assets/icons/icon-192.png",
  "/assets/icons/icon-512.png",
  "/assets/icons/apple-touch-icon.png",
  "/assets/background_sky.png",
  "/assets/background_meadow.png",
  "/assets/background_meadow_desert.png",
  "/assets/background_meadow_snow.png",
  "/assets/reset_button.png",
  "/assets/rules_button.png?v=d85019bc",
  "/assets/Rules.png",
  "/assets/rules_german.png",
  "/assets/language_select.png",
  "/assets/language_de_fill.png",
  "/assets/language_en_fill.png",
  "/assets/contact_information.png",
  "/assets/frosty_dice_title_cropped.png",
  "/assets/surfing_cowboy.png",
  "/assets/bid.png",
  "/assets/bid_front.png",
  "/assets/icecube.png",
  "/assets/icecube2.png",
  "/assets/d7_flag.png",
];
const PRECACHE_REQUEST_URLS = new Set(PRECACHE_URLS.map((path) => self.location.origin + path));

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // addAll is atomic: a failed file prevents this worker from installing.
    await cache.addAll(PRECACHE_URLS.map((path) => new Request(path, { cache: "reload" })));
    // Let updates wait until existing windows close; never replace a live game.
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
      .map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

async function cachedResponse(request, cacheKey = request) {
  let cache;
  try {
    cache = await caches.open(CACHE_NAME);
    // These allowlisted static files have one representation per exact URL.
    // CDN Vary headers must not make an <img> request miss a generic precache fetch.
    const cached = await cache.match(cacheKey, { ignoreVary: true });
    if (cached) return cached;
  } catch {
    // A Cache API failure must not prevent an online page from loading.
  }
  const response = await fetch(request);
  if (cache && response.ok) {
    try {
      await cache.put(cacheKey, response.clone());
    } catch {
      // Serve the network response even if storage is full or unavailable.
    }
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || !request.url.startsWith(self.location.origin + "/")) return;
  const path = request.url.slice(self.location.origin.length).split("?")[0];
  if (request.mode === "navigate" && (path === "/" || path === APP_SHELL)) {
    // Root, index.html, and their query variants all launch the same cached game.
    event.respondWith(cachedResponse(request, APP_SHELL));
  } else if (PRECACHE_REQUEST_URLS.has(request.url)) {
    event.respondWith(cachedResponse(request));
  }
  // Other pages, the worker's own update checks, and external traffic pass through.
});
