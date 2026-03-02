// Minimal SW for PWA installability - no offline caching
// AI checks require network, so offline mode is not useful
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
