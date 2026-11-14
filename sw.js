// Service worker for the CFC clock: shows reminder notifications and opens the clock when tapped.
// It caches nothing, so the page always loads fresh.
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });

self.addEventListener('push', function (e) {
  var d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || 'CFC clock', {
    body: d.body || '',
    tag: d.tag || 'cfc-clock',
    renotify: true,
    icon: 'icon-192.png',
    badge: 'icon-192.png'
  }));
});

self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var url = self.registration.scope;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) {
      if (list[i].url.indexOf(url) === 0 && 'focus' in list[i]) return list[i].focus();
    }
    return self.clients.openWindow(url);
  }));
});
