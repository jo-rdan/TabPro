self.addEventListener('push', function (event) {
  if (!event.data) return;

  const data = event.data.json();
  const title = data.title || 'TabPro';
  const options = {
    body: data.body || '',
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    vibrate: [200, 100, 200],
    data: data.data || {},
    actions: [{ action: 'open', title: 'View orders' }],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(function (clientList) {
        // If waiter tab is already open, focus it
        for (const client of clientList) {
          if (client.url.includes('/waiter') && 'focus' in client) {
            return client.focus();
          }
        }
        // Otherwise open new tab
        if (clients.openWindow) {
          return clients.openWindow('/waiter');
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
