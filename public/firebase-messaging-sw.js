// /public/firebase-messaging-sw.js
// Service Worker mínimo: solo maneja el click de notificación.
// La notificación la renderiza Chrome/FCM por webpush.notification.

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  // Si viene URL en data, la usamos; si no, por defecto
  const url = event.notification?.data?.url || "/chats";

  event.waitUntil(
    (async () => {
      const allClients = await clients.matchAll({ type: "window", includeUncontrolled: true });

      for (const client of allClients) {
        // si ya hay una pestaña abierta, enfocarla y navegar
        if (client.url.includes(self.location.origin)) {
          await client.focus();
          try {
            await client.navigate(url);
          } catch (e) {}
          return;
        }
      }

      // si no hay pestañas, abrir nueva
      await clients.openWindow(url);
    })()
  );
});
