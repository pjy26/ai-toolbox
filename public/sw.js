"use strict";

const CACHE_PREFIX = "amara-pwa-";
const CACHE_NAME = `${CACHE_PREFIX}v1`;
const OFFLINE_URL = "/offline.html";
const PRECACHE_URLS = [
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
  "/icons/apple-touch-icon.png",
];
const PWA_ASSETS = new Set(PRECACHE_URLS);
const PUBLIC_OFFLINE_NAVIGATIONS = new Set([
  "/",
  "/offline.html",
  "/privacy",
  "/terms",
  "/contact",
  "/content-policy",
]);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(
      PRECACHE_URLS.map((url) => new Request(url, { credentials: "omit" })),
    )),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) => Promise.all(
      names
        .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
        .map((name) => caches.delete(name)),
    )),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Only the explicitly public PWA files below may be served from Cache Storage.
  // API, chat, Supabase, authentication, account, membership, and payment traffic
  // is never intercepted here and is never written to a cache.
  if (PWA_ASSETS.has(url.pathname) && request.mode !== "navigate") {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(url.pathname);
      if (cached) return cached;

      const response = await fetch(request);
      if (response.ok && response.type === "basic") {
        await cache.put(url.pathname, response.clone());
      }
      return response;
    })());
    return;
  }

  if (request.mode !== "navigate") return;
  const path = url.pathname.replace(/\/+$/, "") || "/";
  if (!PUBLIC_OFFLINE_NAVIGATIONS.has(path)) return;

  event.respondWith((async () => {
    try {
      // Public navigations use the live response; HTML is never cached.
      return await fetch(request);
    } catch {
      const cache = await caches.open(CACHE_NAME);
      const offlinePage = await cache.match(OFFLINE_URL);
      if (offlinePage) return offlinePage;

      return new Response(
        "<!doctype html><html lang=\"en\"><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width\"><title>Amara · Offline</title><body style=\"font-family:system-ui;background:#F8F5EF;color:#282621;display:grid;place-items:center;min-height:100vh\"><main><h1>You’re offline · 当前离线</h1><p>Please reconnect and try again. · 请重新连接后重试。</p></main></body></html>",
        { headers: { "Content-Type": "text/html; charset=utf-8" } },
      );
    }
  })());
});
