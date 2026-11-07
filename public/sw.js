// Service worker do painel RM27: recebe as notificações e abre a tela certa ao tocar.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let d = {};
  try {
    d = event.data ? event.data.json() : {};
  } catch {}
  event.waitUntil(
    self.registration.showNotification(d.titulo || "RM27 Painel", {
      body: d.corpo || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: d.tag || undefined,
      data: { url: d.url || "/admin" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const destino = new URL((event.notification.data && event.notification.data.url) || "/admin", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((janelas) => {
      for (const j of janelas) {
        if (j.url.startsWith(self.location.origin + "/admin") && "focus" in j) {
          if ("navigate" in j) j.navigate(destino);
          return j.focus();
        }
      }
      return self.clients.openWindow(destino);
    })
  );
});