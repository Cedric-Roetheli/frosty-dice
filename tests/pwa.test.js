import { assert, assertDeepEqual, assertEqual } from "./assert.js";

// Evaluate the real worker with in-memory Cache/Fetch doubles, never a browser
// service-worker registration. Native runners may supply the same source files.
const ORIGIN = "https://frostydice.com";
const absolute = (request) => {
  const url = typeof request === "string" ? request : request.url;
  return url.startsWith("/") ? ORIGIN + url : url;
};
const response = (body, ok = true) => ({ body, ok, clone() { return response(body, ok); } });

function workerHarness(source, varyHeaders = []) {
  const handlers = {};
  const stores = new Map();
  const networkCalls = [];
  const cachedRequests = new Map();
  let offline = false;
  let cacheUnavailable = false;
  let writesUnavailable = false;
  let installFailure = false;
  let claimed = false;
  const cacheStorage = {
    async open(name) {
      if (cacheUnavailable) throw new Error("Cache unavailable");
      if (!stores.has(name)) stores.set(name, new Map());
      const entries = stores.get(name);
      return {
        async addAll(requests) {
          if (installFailure) throw new Error("Required asset unavailable");
          for (const request of requests) {
            assertEqual(request.cache, "reload");
            entries.set(absolute(request), response("cached:" + absolute(request)));
            cachedRequests.set(name + absolute(request), request);
          }
        },
        async match(request, options = {}) {
          const original = cachedRequests.get(name + absolute(request));
          if (!options.ignoreVary && varyHeaders.some((field) =>
            (original?.headers?.[field] ?? null) !== (request.headers?.[field] ?? null))) return undefined;
          return entries.get(absolute(request));
        },
        async put(request, result) {
          if (writesUnavailable) throw new Error("Quota exceeded");
          entries.set(absolute(request), result);
          cachedRequests.set(name + absolute(request), request);
        },
      };
    },
    async keys() { return [...stores.keys()]; },
    async delete(name) { return stores.delete(name); },
  };
  const scope = {
    location: { origin: ORIGIN },
    clients: { async claim() { claimed = true; } },
    addEventListener(type, handler) { handlers[type] = handler; },
    skipWaiting() { throw new Error("Do not replace an active game mid-session"); },
  };
  class RequestDouble {
    constructor(url, options) { this.url = absolute(url); Object.assign(this, options); }
  }
  async function network(request) {
    networkCalls.push(absolute(request));
    if (offline) throw new Error("Offline");
    return response("network:" + absolute(request));
  }
  const configuration = new Function("self", "caches", "fetch", "Request",
    source + "\nreturn { CACHE_NAME, PRECACHE_URLS, APP_SHELL };\n")(
    scope, cacheStorage, network, RequestDouble);
  return {
    ...configuration, stores, networkCalls,
    get claimed() { return claimed; },
    set offline(value) { offline = value; },
    set cacheUnavailable(value) { cacheUnavailable = value; },
    set writesUnavailable(value) { writesUnavailable = value; },
    set installFailure(value) { installFailure = value; },
    async lifecycle(type) {
      let work;
      handlers[type]({ waitUntil(promise) { work = promise; } });
      await work;
    },
    async request(url, properties = {}) {
      let result;
      handlers.fetch({
        request: { url: absolute(url), method: "GET", mode: "cors", ...properties },
        respondWith(promise) { result = promise; },
      });
      return result;
    },
  };
}

async function registrationHarness(source, serviceWorker) {
  let load;
  const window = {
    addEventListener(type, handler, options) {
      assertEqual(type, "load");
      assertEqual(options.once, true);
      load = handler;
    },
  };
  new Function("window", "navigator", source)(window, serviceWorker === undefined ? {} : { serviceWorker });
  await load();
}

export async function runPwaTests(sources) {
  const results = [];
  async function test(name, action) {
    try { await action(); results.push({ name, passed: true }); }
    catch (error) { results.push({ name, passed: false, message: error.message }); }
  }
  if (!sources) {
    try {
      const paths = { worker: "../service-worker.js", registration: "../js/pwa.js", manifest: "../manifest.webmanifest", html: "../index.html" };
      sources = Object.fromEntries(await Promise.all(Object.entries(paths).map(async ([name, url]) => {
        const result = await fetch(url, { cache: "no-store" });
        if (!result.ok) throw new Error("Cannot load " + url);
        return [name, await result.text()];
      })));
    } catch (error) {
      return [{ name: "PWA source files are available", passed: false, message: error.message }];
    }
  }

  await test("Manifest uses the custom-domain root, standalone mode, dark colors, and standard icons", () => {
    const manifest = JSON.parse(sources.manifest);
    assertEqual(manifest.name, "Frosty Dice");
    assertEqual(manifest.short_name, "Frosty Dice");
    assertEqual(manifest.id, "/");
    assertEqual(manifest.start_url, "/");
    assertEqual(manifest.scope, "/");
    assertEqual(manifest.display, "standalone");
    assertEqual(manifest.theme_color, "#03020e");
    assertEqual(manifest.background_color, "#03020e");
    assertDeepEqual(manifest.icons.map((icon) => [icon.sizes, icon.type, icon.purpose]),
      [["192x192", "image/png", "any"], ["512x512", "image/png", "any"]]);
  });

  await test("PWA metadata preserves the viewport and provides the Apple touch icon and standalone mode", () => {
    assert(sources.html.includes('<meta name="viewport" content="width=device-width, initial-scale=1">'));
    assert(sources.html.includes('<link rel="manifest" href="./manifest.webmanifest">'));
    assert(sources.html.includes('sizes="180x180" href="./assets/icons/apple-touch-icon.png"'));
    assert(sources.html.includes('name="apple-mobile-web-app-capable" content="yes"'));
    assert(sources.html.includes('name="apple-mobile-web-app-status-bar-style" content="black"'));
    assert(sources.html.includes('src="./js/pwa.js"'));
  });

  await test("Rules keep their anchor and English heading with semantic accessible language buttons", () => {
    assert(sources.html.includes('href="#rules"'));
    assert(sources.html.includes('<h2 id="rules-heading">Rules</h2>'));
    assert(sources.html.includes('id="rules-image" src="./assets/Rules.png"'));
    assert(sources.html.includes('src="./js/rules.js"'));
    for (const [language, label, pressed] of [["de", "Deutsch", "false"], ["en", "English", "true"]]) {
      const button = sources.html.match(new RegExp('<button id="rules-language-' + language + '"[^>]*>'))?.[0];
      assert(button, language);
      assert(button.includes('type="button"'));
      assert(button.includes('aria-label="' + label + '"'));
      assert(button.includes('aria-pressed="' + pressed + '"'));
      assert(button.includes('aria-controls="rules-image"'));
    }
  });

  await test("Registration waits for page load and checks for updates without the HTTP cache", async () => {
    const calls = [];
    await registrationHarness(sources.registration, { async register(...args) { calls.push(args); } });
    assertDeepEqual(calls, [["/service-worker.js", { scope: "/", updateViaCache: "none" }]]);
  });

  await test("Missing, rejected, and synchronously blocked registration never break the website", async () => {
    await registrationHarness(sources.registration);
    await registrationHarness(sources.registration, { async register() { throw new Error("Denied"); } });
    await registrationHarness(sources.registration, { register() { throw new Error("Blocked"); } });
  });

  await test("Install precaches every declared file with fresh requests, including query-versioned resources", async () => {
    const worker = workerHarness(sources.worker);
    await worker.lifecycle("install");
    const stored = worker.stores.get(worker.CACHE_NAME);
    assertEqual(stored.size, worker.PRECACHE_URLS.length);
    for (const path of worker.PRECACHE_URLS) assert(stored.has(absolute(path)), path);
    assert(worker.PRECACHE_URLS.includes("/assets/Rules.png"));
    assert(worker.PRECACHE_URLS.includes("/assets/contact_information.png"));
    assert(worker.PRECACHE_URLS.includes("/assets/bid.png"));
    assert(worker.PRECACHE_URLS.includes("/assets/icecube.png"));
    assert(worker.PRECACHE_URLS.includes("/assets/icecube2.png"));
    for (const path of ["/assets/reset_button.png", "/assets/rules_button.png?v=d85019bc",
      "/assets/background_sky.png", "/assets/background_meadow.png", "/assets/icons/icon-192.png",
      "/assets/icons/icon-512.png", "/assets/icons/apple-touch-icon.png"]) {
      assert(worker.PRECACHE_URLS.includes(path), path);
    }
  });

  await test("A failed new installation leaves the previous cache intact and never claims clients", async () => {
    const worker = workerHarness(sources.worker);
    const original = new Map([[absolute("/index.html"), response("previous release")]]);
    worker.stores.set("frosty-dice-pwa-v3", original);
    worker.installFailure = true;
    let rejected = false;
    try { await worker.lifecycle("install"); } catch { rejected = true; }
    assert(rejected);
    assertEqual(worker.stores.get("frosty-dice-pwa-v3"), original);
    assertEqual(worker.claimed, false);
  });

  await test("Activation deletes only obsolete Frosty Dice PWA caches and then claims clients", async () => {
    const worker = workerHarness(sources.worker);
    await worker.lifecycle("install");
    worker.stores.set("frosty-dice-pwa-v1", new Map());
    worker.stores.set("frosty-dice-pwa-v3", new Map());
    worker.stores.set("another-app-cache", new Map());
    await worker.lifecycle("activate");
    assert(worker.stores.has(worker.CACHE_NAME));
    assert(!worker.stores.has("frosty-dice-pwa-v1"));
    assert(!worker.stores.has("frosty-dice-pwa-v3"));
    assert(worker.stores.has("another-app-cache"));
    assertEqual(worker.claimed, true);
  });

  await test("Root, index, and query-string navigations launch the cached shell offline", async () => {
    const worker = workerHarness(sources.worker);
    await worker.lifecycle("install");
    worker.offline = true;
    for (const path of ["/", "/index.html", "/?from=home", "/index.html?from=home"]) {
      assertEqual((await worker.request(path, { mode: "navigate" })).body, "cached:" + ORIGIN + "/index.html");
    }
    assertEqual(worker.networkCalls.length, 0);
  });

  await test("Every precached module, icon, and image is available offline without a network request", async () => {
    const worker = workerHarness(sources.worker);
    await worker.lifecycle("install");
    worker.offline = true;
    for (const path of worker.PRECACHE_URLS) assert((await worker.request(path)).body.startsWith("cached:"));
    assertEqual(worker.networkCalls.length, 0);
  });

  await test("First conditional image requests work offline despite different Vary request headers", async () => {
    // The CDN sends Vary: Accept-Encoding; image requests can also vary in Accept.
    const worker = workerHarness(sources.worker, ["accept-encoding", "accept"]);
    await worker.lifecycle("install");
    worker.offline = true;
    for (const path of worker.PRECACHE_URLS.filter((url) => url.includes("/assets/"))) {
      const result = await worker.request(path, {
        mode: "no-cors", destination: "image",
        headers: { "accept-encoding": "gzip, deflate, br", accept: "image/webp,image/*,*/*;q=0.8" },
      });
      assertEqual(result.body, "cached:" + absolute(path), path);
    }
    assertEqual(worker.networkCalls.length, 0);
  });

  await test("Both Rules illustrations, selector, fill overlays, and controller are precached for offline switching", async () => {
    const worker = workerHarness(sources.worker);
    await worker.lifecycle("install");
    worker.offline = true;
    for (const path of ["/assets/Rules.png", "/assets/rules_german.png", "/assets/language_select.png",
      "/assets/language_de_fill.png", "/assets/language_en_fill.png", "/js/rules.js"]) {
      assert(worker.PRECACHE_URLS.includes(path), path);
      assertEqual((await worker.request(path)).body, "cached:" + absolute(path));
    }
    assertEqual(worker.networkCalls.length, 0);
  });

  await test("A running release stays internally consistent until its replacement activates", async () => {
    const worker = workerHarness(sources.worker);
    await worker.lifecycle("install");
    worker.stores.set("frosty-dice-pwa-next", new Map([[absolute("/index.html"), response("next release")]]));
    assertEqual((await worker.request("/", { mode: "navigate" })).body, "cached:" + ORIGIN + "/index.html");
    assertEqual(worker.networkCalls.length, 0);
  });

  await test("External, POST, unrelated pages, worker updates, and unknown resource versions pass through", async () => {
    const worker = workerHarness(sources.worker);
    for (const [path, properties] of [["https://example.org/", {}], ["/", { method: "POST", mode: "navigate" }],
      ["/tests/", { mode: "navigate" }], ["/service-worker.js", {}], ["/js/app.js?v=unknown", {}]]) {
      assertEqual(await worker.request(path, properties), undefined);
    }
  });

  await test("A cache miss uses the network and stores a successful response", async () => {
    const worker = workerHarness(sources.worker);
    const result = await worker.request("/assets/bid.png");
    assertEqual(result.body, "network:" + ORIGIN + "/assets/bid.png");
    worker.offline = true;
    assertEqual((await worker.request("/assets/bid.png")).body, result.body);
  });

  await test("Cache read and write failures leave online resources usable", async () => {
    for (const setting of ["cacheUnavailable", "writesUnavailable"]) {
      const worker = workerHarness(sources.worker);
      worker[setting] = true;
      const result = await worker.request("/", { mode: "navigate" });
      assertEqual(result.body, "network:" + ORIGIN + "/");
    }
  });

  return results;
}
