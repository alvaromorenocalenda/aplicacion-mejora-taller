"use client";

import { useEffect } from "react";
import { getMessaging, isSupported, onMessage } from "firebase/messaging";
import { firebaseApp } from "@/lib/firebase";

/**
 * NOTIFICACIONES EN FOREGROUND (app abierta)
 *
 * En Web Push / FCM:
 * - Si la pestaña está en background o cerrada, el Service Worker gestiona el push ✅
 * - Si la web está abierta y activa, el Service Worker NO recibe el push,
 *   así que hay que escuchar con onMessage() y mostrar la notificación manualmente ✅
 */
export default function ForegroundFCMListener() {
  useEffect(() => {
    let unsubscribe;

    (async () => {
      if (typeof window === "undefined") return;
      if (typeof Notification === "undefined") return;

      const supported = await isSupported().catch(() => false);
      if (!supported) return;

      // Si aún no hay permiso, no lo pedimos aquí (para no spamear prompts).
      if (Notification.permission !== "granted") return;

      const messaging = getMessaging(firebaseApp);

      unsubscribe = onMessage(messaging, async (payload) => {
        try {
          const data = payload?.data || {};

          const title =
            data.title || payload?.notification?.title || "Nuevo mensaje";
          const body =
            data.body || payload?.notification?.body || "Tienes un mensaje";
          const url = data.url || "/";

          // Si usas tag por chat, Android a veces "reemplaza" y no suena.
          // renotify:true fuerza que vuelva a sonar aunque reemplace.
          const tag =
            data.tag || (data.chatId ? `chat-${data.chatId}` : undefined);

          // Preferimos mostrar con el SW para mantener el click handler (notificationclick)
          // centralizado en firebase-messaging-sw.js.
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

          // Fallback si no hay SW (raro, pero por seguridad)
          const n = new Notification(title, options);
          n.onclick = () => {
            try {
              window.focus();
              window.location.href = url;
            } catch {
              // ignore
            }
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
