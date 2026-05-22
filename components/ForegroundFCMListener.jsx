"use client";

import { useEffect } from "react";
import { getMessaging, isSupported, onMessage } from "firebase/messaging";
import { firebaseApp } from "@/lib/firebase";

export default function ForegroundFCMListener() {
  useEffect(() => {
    let unsubscribe;

    (async () => {
      if (typeof window === "undefined") return;
      if (typeof Notification === "undefined") return;

      const supported = await isSupported().catch(() => false);
      if (!supported) return;

      const messaging = getMessaging(firebaseApp);

      unsubscribe = onMessage(messaging, async (payload) => {
        try {
          const data = payload?.data || {};

          const title =
            data.title || payload?.notification?.title || "Nuevo mensaje";
          const body =
            data.body || payload?.notification?.body || "Tienes un mensaje";
          const url = data.url || "/";

          if (Notification.permission !== "granted") return;

          const tag =
            data.tag || (data.chatId ? `chat-${data.chatId}` : undefined);

          let swReg =
            (await navigator.serviceWorker.getRegistration(
              "/firebase-messaging-sw.js"
            )) || (await navigator.serviceWorker.getRegistration());

          const options = {
            body,
            tag,
            renotify: true,
            data: { url },
          };

          if (swReg?.showNotification) {
            await swReg.showNotification(title, options);
            return;
          }

          const n = new Notification(title, options);
          n.onclick = () => {
            window.focus();
            window.location.href = url;
          };
        } catch (e) {
          console.error("Error mostrando notificación en foreground:", e);
        }
      });
    })();

    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, []);

  return null;
}
