// Browser Notification Utilities
// Handles browser notifications and reminders for medication doses

/**
 * Request notification permission from user
 */
export const requestNotificationPermission = async () => {
  if (!('Notification' in window)) {
    console.warn('This browser does not support notifications');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  return false;
};

/**
 * Send notification to service worker (works even when website is closed)
 */
const sendNotificationToServiceWorker = async (title, options) => {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.ready;
      if (registration.active) {
        registration.active.postMessage({
          type: 'SHOW_NOTIFICATION',
          title: title,
          options: options
        });
        console.log('Notification sent to Service Worker');
      }
    } catch (error) {
      console.error('Error sending message to Service Worker:', error);
    }
  }
};

/**
 * Check if notifications are supported and enabled
 */
export const isNotificationSupported = () => {
  return 'Notification' in window;
};

/**
 * Check if notifications are permitted
 */
export const isNotificationPermitted = () => {
  return Notification.permission === 'granted';
};

/**
 * Show a notification
 */
export const showNotification = (title, options = {}) => {
  if (!isNotificationSupported() || !isNotificationPermitted()) {
    return null;
  }

  const notificationOptions = {
    body: options.body || '',
    icon: options.icon || '/vite.svg',
    badge: '/vite.svg',
    tag: options.tag || 'seniorpill-reminder',
    requireInteraction: options.requireInteraction || false,
    silent: options.silent || false,
    ...options
  };

  try {
    const notification = new Notification(title, notificationOptions);

    // Auto-close after 10 seconds if not requiring interaction
    if (!notificationOptions.requireInteraction) {
      setTimeout(() => {
        notification.close();
      }, 10000);
    }

    return notification;
  } catch (error) {
    console.error('Error showing notification:', error);
    return null;
  }
};

/**
 * Show medication reminder notification
 * Works even when website is closed via service worker
 */
export const showDoseReminder = (doseType, doseTime) => {
  const title = `💊 Time to take ${doseType} pills`;
  const body = `Your ${doseType} medication is due now (${doseTime})`;

  const options = {
    body: body,
    tag: `dose-reminder-${doseType}`,
    requireInteraction: true,
    icon: '/vite.svg',
    badge: '/vite.svg'
  };

  // Send to service worker for background notifications
  sendNotificationToServiceWorker(title, options);

  // Also show in foreground if app is open
  return showNotification(title, options);
};

/**
 * Show missed dose notification
 */
export const showMissedDoseAlert = (doseType) => {
  const title = `⚠️ Missed ${doseType} dose`;
  const body = `You missed your ${doseType} medication. Please contact your caregiver if needed.`;

  return showNotification(title, {
    body: body,
    tag: `missed-dose-${doseType}`,
    requireInteraction: false,
    icon: '/vite.svg'
  });
};

/**
 * Show low stock notification
 */
export const showLowStockAlert = (doseType, count) => {
  const title = `⚠️ Low ${doseType} pill stock`;
  const body = `Only ${count} ${doseType} pills remaining. Please refill soon.`;

  return showNotification(title, {
    body: body,
    tag: `low-stock-${doseType}`,
    requireInteraction: false
  });
};

