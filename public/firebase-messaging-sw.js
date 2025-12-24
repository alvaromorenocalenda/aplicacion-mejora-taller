// /public/firebase-messaging-sw.js
// SW mínimo: NO muestra notificaciones (las muestra FCM por webpush.notification)
// Solo gestiona el click.

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  // En webpush.notification no siempre viene event.notification.data,
  // así que abrimos el chat "general" si no hay url.
  const fallbackUrl = "/chats";
  const url = event.notification?.data?.url || fallbackUrl;

  event.waitUntil(
    (async () => {
      const allClients = await clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      // Si ya existe una pestaña de tu web, enfócala
      for (const client of allClients) {
        if (client.url.includes(self.location.origin)) {
          await client.focus();
          try {
            await client.navigate(url);
          } catch (e) {}
          return;
        }
      }

      // si no, abrir nueva
      await clients.openWindow(url);
    })()
  );
});
