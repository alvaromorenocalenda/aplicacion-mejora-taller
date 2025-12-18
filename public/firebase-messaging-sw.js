// /public/firebase-messaging-sw.js
// Service Worker para notificaciones push (Firebase Cloud Messaging) en web (PC).

importScripts("https://www.gstatic.com/firebasejs/10.12.4/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.4/firebase-messaging-compat.js");

let messagingInitialized = false;

async function initMessaging() {
  if (messagingInitialized) return;
  try {
    const res = await fetch("/api/firebase-config");
    const config = await res.json();

    if (!firebase.apps.length) {
      firebase.initializeApp(config);
    }

    firebase.messaging(); // init
    messagingInitialized = true;
  } catch (e) {
    // Si falla, el SW no podrá mostrar notificaciones.
    console.error("FCM SW init error", e);
  }
}

// Inicializar cuanto antes
initMessaging();

// Notificaciones en background
self.addEventListener("push", async (event) => {
  await initMessaging();

  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (e) {
    payload = { notification: { title: "Nuevo mensaje", body: "Tienes un mensaje nuevo" } };
  }

  const title = payload?.notification?.title || "Nuevo mensaje";
  const options = {
    body: payload?.notification?.body || "Tienes un mensaje nuevo",
    data: payload?.data || {},
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Al hacer click, abrir el enlace del chat si viene en data.url
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification?.data?.url || "/chats";

  event.waitUntil(
    (async () => {
      const allClients = await clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of allClients) {
        if (client.url.includes(self.location.origin)) {
          client.focus();
          client.navigate(url);
          return;
        }
      }
      await clients.openWindow(url);
    })()
  );
});
