// /public/firebase-messaging-sw.js
importScripts("https://www.gstatic.com/firebasejs/10.12.4/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.4/firebase-messaging-compat.js");

let messaging;

// Carga config desde tu endpoint (lo tienes ya: /api/firebase-config)
async function initFirebase() {
  if (messaging) return;

  const res = await fetch("/api/firebase-config");
  const config = await res.json();

  if (!firebase.apps.length) {
    firebase.initializeApp(config);
  }

  messaging = firebase.messaging();
}

initFirebase().catch((e) => console.error("SW initFirebase error", e));

// ✅ Recibe DATA-ONLY y muestra la notificación aquí (UNA SOLA VEZ)
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

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

// ✅ La forma correcta con FCM en Web: onBackgroundMessage
// (en compat está disponible como messaging.onBackgroundMessage)
(async () => {
  await initFirebase();

  messaging.onBackgroundMessage((payload) => {
    try {
      const data = payload?.data || {};
      const title = data.title || "Nuevo mensaje";
      const body = data.body || "Tienes un mensaje nuevo";
      const url = data.url || "/chats";

      self.registration.showNotification(title, {
        body,
        data: { url },
      });
    } catch (e) {
      console.error("onBackgroundMessage error", e);
    }
  });
})();
