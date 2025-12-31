"use client";

import { useEffect } from "react";
import { getMessaging, isSupported, onMessage } from "firebase/messaging";
import { firebaseApp } from "@/lib/firebase";

function shouldPlaySound() {
  try {
    return localStorage.getItem("notif_sound_enabled") === "1";
  } catch {
    return false;
  }
}

async function playSound() {
  try {
    if (!shouldPlaySound()) return;

    const audio = new Audio("/sounds/notify.mp3");
    audio.volume = 1;
    await audio.play();
  } catch (e) {
    // Si el navegador bloquea audio, no rompemos nada
    console.warn("Audio bloqueado/no disponible:", e);
  }
}

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
        const data = payload?.data || {};
        const title =
          data.title || payload?.notification?.title || "Nuevo mensaje";
        const body =
          data.body || payload?.notification?.body || "Tienes un mensaje";
        const url = data.url || "/";

        // 1) SONIDO EN FOREGROUND (lo fiable en tablets)
        await playSound();

        // 2) NOTIFICACIÓN VISUAL TAMBIÉN (si hay permiso)
        try {
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
