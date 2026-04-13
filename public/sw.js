const CACHE_NAME = "ping-v1";
self.addEventListener("install", (e) => { self.skipWaiting(); });
self.addEventListener("activate", (e) => { self.clients.claim(); });
self.addEventListener("push", (e) => {
  let data = { title: "PING!", body: "Quelqu'un t'a ping!", sound: "bip" };
  try { data = e.data.json(); } catch {}
  const options = {
    body: data.body || "Quelqu'un t'a ping!",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    vibrate: [200, 100, 200, 100, 200],
    tag: "ping-" + Date.now(),
    renotify: true,
    data: { sound: data.sound || "bip", url: "/", from: data.from || "?" },
  };
  e.waitUntil(
    self.registration.showNotification(data.title || "PING!", options).then(() => {
      return self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: "PLAY_SOUND", sound: data.sound || "bip", from: data.from || "?" });
        });
      });
    })
  );
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => {
      if (clients.length > 0) {
        clients[0].focus();
        clients[0].postMessage({ type: "PLAY_SOUND", sound: e.notification.data?.sound || "bip", from: e.notification.data?.from || "?" });
      } else {
        self.clients.openWindow("/");
      }
    })
  );
});
