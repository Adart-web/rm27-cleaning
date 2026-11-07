// Service worker do painel RM27 (v2): recebe as notificações e abre a tela certa ao tocar.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let d = {};
  try {
    d = event.data ? event.data.json() : {};
  } catch {
    try {
      d = { corpo: event.data ? event.data.text() : "" };
    } catch {}
  }
  const titulo = d.titulo || "RM27 Painel";
  const url = d.url || "/admin";
  const opcoes = { body: d.corpo || "", data: { url } };
  if (d.tag) opcoes.tag = d.tag;
  event.waitUntil(
    self.registration
      .showNotification(titulo, { ...opcoes, icon: "/icon-192.png", badge: "/icon-192.png" })
      .catch(() => self.registration.showNotification(titulo, opcoes))
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