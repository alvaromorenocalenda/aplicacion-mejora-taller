// /public/firebase-messaging-sw.js
// Service Worker para notificaciones push (Firebase Cloud Messaging) en web (PC).

importScripts("https://www.gstatic.com/firebasejs/10.12.4/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.4/firebase-messaging-compat.js");

let messagingInitialized = false;
let messaging = null;

async function initMessaging() {
  if (messagingInitialized) return;
  try {
    const res = await fetch("/api/firebase-config");
    const config = await res.json();

    if (!firebase.apps.length) {
      firebase.initializeApp(config);
    }

    messaging = firebase.messaging();
    messagingInitialized = true;

    // ✅ Manejo correcto en BACKGROUND (evita duplicados)
    messaging.onBackgroundMessage((payload) => {
      const data = payload?.data || {};

      const title = data.title || "Nuevo mensaje";
      const options = {
        body: data.body || "Tienes un mensaje nuevo",
        data: { url: data.url || "/chats" },
      };

      self.registration.showNotification(title, options);
    });
  } catch (e) {
    console.error("FCM SW init error", e);
  }
}

// Inicializar cuanto antes
initMessaging();

// Click en notificación -> abrir el chat
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification?.data?.url || "/chats";

  event.waitUntil(
    (async () => {
      const allClients = await clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of allClients) {
        if (client.url.includes(self.location.origin)) {
          await client.focus();
          try {
            await client.navigate(url);
          } catch (e) {}
          return;
        }
      }
      await clients.openWindow(url);
    })()
  );
});
