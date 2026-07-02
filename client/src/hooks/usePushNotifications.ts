import { useState } from 'react';

interface PushSubscribeOptions {
  venueId: string;
  staffId?: string;
}

export function usePushNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );

  const isSupported =
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window;

  const subscribe = async ({ venueId, staffId }: PushSubscribeOptions): Promise<boolean> => {
    if (!isSupported) return false;

    try {
      // Register service worker
      const registration = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      // Request permission
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') return false;

      // Get VAPID public key from server
      const keyRes = await fetch('/api/push/vapid-key');
      const keyData = await keyRes.json();
      if (!keyData.data?.publicKey) return false;

      // Convert VAPID key
      const vapidKey = urlBase64ToUint8Array(keyData.data.publicKey);

      // Subscribe to push
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidKey,
      });

      const sub = subscription.toJSON();

      // Save subscription to server
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          venueId,
          staffId,
          subscription: {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.keys?.p256dh, auth: sub.keys?.auth },
          },
        }),
      });

      return true;
    } catch (err) {
      console.error('[Push] Subscription failed:', err);
      return false;
    }
  };

  return { isSupported, permission, subscribe };
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}
