// MCAS Reaction Tracker — Service Worker
// Caches the app shell for offline use, queues writes when offline

const CACHE_NAME = "mcas-v1";
const SHELL = ["/", "/index.html", "/src/main.jsx", "/src/App.jsx", "/src/index.css", "/src/App.css"];

// ── INSTALL: cache app shell ──────────────────────────────────────────────────
self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

// ── ACTIVATE: clean old caches ───────────────────────────────────────────────
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── FETCH: network-first for Supabase, cache-first for assets ────────────────
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);

  // Always network-first for Supabase API calls
  if (url.hostname.includes("supabase.co")) {
    e.respondWith(
      fetch(e.request).catch(() =>
        new Response(JSON.stringify({ data: null, error: { message: "offline" } }), {
          headers: { "Content-Type": "application/json" },
        })
      )
    );
    return;
  }

  // Cache-first for everything else (app shell / assets)
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(resp => {
        if (resp && resp.status === 200 && e.request.method === "GET") {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return resp;
      }).catch(() => caches.match("/index.html"));
    })
  );
});

// ── BACKGROUND SYNC: flush queued writes when back online ────────────────────
self.addEventListener("sync", e => {
  if (e.tag === "mcas-sync") {
    e.waitUntil(flushQueue());
  }
});

async function flushQueue() {
  // Notify all open clients to flush — they hold the Supabase client
  const clients = await self.clients.matchAll({ type: "window" });
  clients.forEach(c => c.postMessage({ type: "FLUSH_QUEUE" }));
}
