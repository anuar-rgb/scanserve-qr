// Service Worker for ScanServe Web Push Notifications
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: "Уведомление", body: event.data.text() };
  }

  const title = data.title || "АС ТӨРІ";
  const options = {
    body: data.body || "",
    icon: data.icon || "/favicon.ico",
    badge: data.badge || "/favicon.ico",
    data: data.url ? { url: data.url } : undefined,
    vibrate: [200, 100, 200],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url;
  if (url) {
    event.waitUntil(clients.openWindow(url));
  }
});
