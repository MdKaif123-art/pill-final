// Service Worker for Background Notifications
// This allows notifications even when the website is closed

self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  event.waitUntil(self.clients.claim());
});

// Handle messages from the main app (works even when website is closed)
self.addEventListener('message', (event) => {
  console.log('Message received in service worker:', event.data);

  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, options } = event.data;
    const notificationOptions = {
      body: options.body || '',
      icon: options.icon || '/vite.svg',
      badge: '/vite.svg',
      tag: options.tag || 'seniorpill-reminder',
      requireInteraction: options.requireInteraction || false,
      data: options.data || {}
    };

    self.registration.showNotification(title, notificationOptions);
  }
});

// Handle push events (fallback for non-FCM push)
self.addEventListener('push', (event) => {
  console.log('Push notification received:', event);

  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: event.data.text() || 'SeniorPill Reminder' };
    }
  }

  const title = data.title || 'SeniorPill Reminder';
  const options = {
    body: data.body || 'Medication reminder',
    icon: data.icon || '/vite.svg',
    badge: '/vite.svg',
    tag: data.tag || 'seniorpill-reminder',
    requireInteraction: data.requireInteraction || false,
    data: data.data || {}
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event);
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a window is already open, focus it
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise, open a new window
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});

