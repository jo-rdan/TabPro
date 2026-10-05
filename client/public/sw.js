self.addEventListener('push', function (event) {
  if (!event.data) return;

  const data = event.data.json();
  const title = data.title || 'Skuzi';
  const options = {
    body: data.body || '',
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    vibrate: [200, 100, 200],
    data: data.data || {},
    // Each table's alert gets its own notification instead of replacing the last.
    tag: (data.data && data.data.url ? data.data.url : '') + ':' + Date.now(),
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  // The server says where to go: the owner dashboard or the waiter's orders.
  const url = (event.notification.data && event.notification.data.url) || '/waiter/orders';

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(function (clientList) {
        for (const client of clientList) {
          if (new URL(client.url).pathname.startsWith(url) && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
  );
});

self.addEventListener('install', function (event) {
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(clients.claim());
});
