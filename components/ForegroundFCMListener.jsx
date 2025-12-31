"use client";

import { useEffect } from "react";
import { getMessaging, isSupported, onMessage } from "firebase/messaging";
import { firebaseApp } from "@/lib/firebase";

/**
 * Escucha mensajes FCM cuando la app está ABIERTA (foreground).
 *
 * Con DATA-ONLY, cuando la pestaña está activa, el Service Worker no recibe
 * el evento `push`, así que no se muestra notificación. Esto lo soluciona
 * escuchando con `onMessage()` y mostrando una notificación manualmente.
 */
export default function ForegroundFCMListener() {
  useEffect(() => {
    let unsubscribe;

    (async () => {
      // Evitar SSR / entornos sin Notification
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
          const body = data.body || payload?.notification?.body || "";
          const url = data.url || "/";
          const tag =
            data.tag || (data.chatId ? `chat-${data.chatId}` : undefined);

          // Si el usuario aún no dio permisos, no molestamos pidiéndolos aquí.
          if (Notification.permission !== "granted") return;

          // Intentar mostrar con el SW (mejor comportamiento + click handler centralizado)
          let swReg =
            (await navigator.serviceWorker.getRegistration(
              "/firebase-messaging-sw.js"
            )) || (await navigator.serviceWorker.getRegistration());

          if (swReg?.showNotification) {
            swReg.showNotification(title, {
              body,
              tag,
              data: { url },
            });
            return;
          }

          // Fallback: Notification directa
          const n = new Notification(title, { body, tag });
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
