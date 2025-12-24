self.addEventListener("push", event => {
  const data = event.data?.json()?.data || {};

  const title = data.title || "Nuevo mensaje";
  const body = data.body || "Tienes un mensaje";
  const url = data.url || "/";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      data: { url },
    })
  );
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const url = event.notification.data.url;

  event.waitUntil(
    clients.openWindow(url)
  );
});
