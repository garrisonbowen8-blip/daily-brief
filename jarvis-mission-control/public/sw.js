// Minimal service worker — exists so the dashboard is installable as an app.
// Deliberately NOT caching app code (network passthrough) so you never get a
// stale dashboard after an update.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {
  // no-op: let the browser handle every request from the network as normal
});
