/* eslint-disable no-restricted-globals */

/**
 * Service Worker para notificaciones (FCM data-only).
 *
 * Cloud Function envía data: { title, body, url, chatId, tag }
 * Aquí mostramos la notificación y al hacer click abrimos/focalizamos la URL.
 *
 * Importante: usamos DATA-ONLY para evitar duplicados.
 */

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }

  // FCM suele meter los datos en payload.data
  const data = payload?.data || payload || {};

  const title = data.title || "Nuevo mensaje";
  const body = data.body || "Tienes un mensaje";
  const url = data.url || "/";
  const tag = data.tag || (data.chatId ? `chat-${data.chatId}` : undefined);

  const options = {
    body,
    tag, // agrupa/reemplaza notificaciones del mismo chat
    data: { url },
    // icon: "/icon-192.png",
    // badge: "/badge-72.png",
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification?.data?.url || "/";

  event.waitUntil(
    (async () => {
      const allClients = await clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      for (const client of allClients) {
        try {
          const clientUrl = new URL(client.url);
          const targetUrl = new URL(url, self.location.origin);

          if (clientUrl.origin === targetUrl.origin) {
            await client.focus();
            if (
              clientUrl.pathname + clientUrl.search !==
              targetUrl.pathname + targetUrl.search
            ) {
              client.navigate(targetUrl.href);
            }
            return;
          }
        } catch {
          // ignore
        }
      }

      return clients.openWindow(url);
    })()
  );
});
