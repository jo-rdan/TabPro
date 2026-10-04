import { useEffect, useRef, useState } from "react";
import api from "../lib/api";

interface PushSubscribeOptions {
  venueId: string;
  staffId?: string;
  // Waiters sign in with a staff token, not the owner token api.ts attaches.
  token?: string;
}

export function usePushNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "default",
  );

  const isSupported =
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window;

  // iPhones only allow web notifications for sites added to the Home Screen.
  const isIOS = typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isStandalone =
    typeof window !== "undefined" &&
    (window.matchMedia?.("(display-mode: standalone)").matches || (navigator as any).standalone === true);
  const needsHomeScreen = isIOS && !isStandalone;

  const subscribe = async ({
    venueId,
    staffId,
    token,
  }: PushSubscribeOptions): Promise<boolean> => {
    if (!isSupported) return false;

    try {
      // Register service worker
      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      // Request permission
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") return false;

      // Get VAPID public key from server. Use the shared `api` client (not
      // raw fetch) so this respects VITE_API_URL like every other request —
      // a hardcoded "/api/..." path silently breaks when the client and
      // server are deployed on different origins.
      const keyRes = await api.get("/push/vapid-key");
      const publicKey = keyRes.data?.data?.publicKey;
      if (!publicKey) {
        console.error("[Push] No VAPID public key returned by server.");
        return false;
      }

      // Convert VAPID key
      const vapidKey = urlBase64ToUint8Array(publicKey);

      // Subscribe to push
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidKey as unknown as ArrayBuffer,
      });

      const sub = subscription.toJSON();

      // Save subscription to server. axios throws on non-2xx by default, so
      // a failed save now correctly falls through to the catch block below
      // instead of silently reporting success.
      await api.post("/push/subscribe", {
        venueId,
        staffId,
        subscription: {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.keys?.p256dh, auth: sub.keys?.auth },
        },
      }, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined);

      return true;
    } catch (err) {
      console.error("[Push] Subscription failed:", err);
      return false;
    }
  };

  return { isSupported, permission, subscribe, needsHomeScreen };
}

// Already allowed on this device? Quietly (re)register it on every visit: the
// server may have forgotten it (new database, expired subscription), and the
// "Enable" banner only shows while permission is still undecided.
export function useKeepPushSubscribed(options: PushSubscribeOptions | null) {
  const { isSupported, subscribe } = usePushNotifications();
  const done = useRef("");
  const key = options ? `${options.venueId}|${options.staffId ?? ""}|${options.token ?? ""}` : "";
  useEffect(() => {
    if (!options || !isSupported || done.current === key) return;
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    done.current = key;
    subscribe(options).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, isSupported]);
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}
