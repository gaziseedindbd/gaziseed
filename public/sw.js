const CACHE_NAME = 'super-king-seed-shell-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Intentionally no fetch interception: the installed app always uses the live site
// and this service worker does not introduce stale-page/cache issues.
