let swToken = null;
let swApiOrigin = null;
let swSeenIds = new Set();
let swPollTimer = null;

const KIND_TITLE = {
  APPROVAL: "Persetujuan Dokumen",
  STOK: "Update Stok & Gudang",
  PENGIRIMAN: "Update Pengiriman",
  LEAD: "Prospek & Penawaran",
  TUGAS: "Tugas & Project",
  SURAT: "Surat Jalan & Dokumen",
  LAINNYA: "Notifikasi Taska ERP",
};

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

async function checkBackgroundNotifications() {
  if (!swToken || !swApiOrigin) return;
  try {
    const clientList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const anyFocusedAndVisible = clientList.some((c) => c.focused && c.visibilityState === "visible");
    // Jika tab sedang dibuka dan fokus, biarkan tab utama yang menampilkan popup pojok kanan atas
    if (anyFocusedAndVisible) return;

    const res = await fetch(`${swApiOrigin}/api/notifications?unread=true&limit=5`, {
      headers: {
        Authorization: `Bearer ${swToken}`,
        Accept: "application/json",
      },
    });
    if (!res.ok) return;
    const data = await res.json();
    const items = Array.isArray(data?.items) ? data.items : [];
    for (const item of items) {
      const idStr = String(item.id);
      if (swSeenIds.has(idStr)) continue;
      swSeenIds.add(idStr);
      const title = KIND_TITLE[item.kind] || "Taska Mini ERP";
      const body = item.text || "Ada notifikasi baru untuk Anda";
      const href = item.href || "/";
      await self.registration.showNotification(title, {
        body,
        tag: `taska-notif-${idStr}`,
        renotify: true,
        data: { href, id: item.id },
      });
    }
  } catch {}
}

function startBackgroundPolling() {
  if (swPollTimer) clearInterval(swPollTimer);
  swPollTimer = setInterval(() => {
    checkBackgroundNotifications();
  }, 10000);
}

self.addEventListener("message", (event) => {
  const msg = event.data;
  if (!msg || typeof msg !== "object") return;
  if (msg.type === "SET_AUTH") {
    swToken = msg.token || null;
    swApiOrigin = msg.apiOrigin || null;
    if (Array.isArray(msg.seenIds)) {
      for (const id of msg.seenIds) swSeenIds.add(String(id));
    }
    if (swToken && swApiOrigin) {
      startBackgroundPolling();
    } else if (swPollTimer) {
      clearInterval(swPollTimer);
      swPollTimer = null;
    }
  } else if (msg.type === "MARK_SEEN" && msg.id != null) {
    swSeenIds.add(String(msg.id));
  } else if (msg.type === "SHOW_OS_NOTIF") {
    const { title, body, tag, href } = msg;
    if (msg.id != null) swSeenIds.add(String(msg.id));
    event.waitUntil(
      self.registration.showNotification(title || "Taska Mini ERP", {
        body: body || "",
        tag: tag || `taska-${Date.now()}`,
        renotify: true,
        data: { href: href || "/" },
      })
    );
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetHref = (event.notification.data && event.notification.data.href) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.focus();
          client.postMessage({ type: "NAVIGATE_NOTIF", href: targetHref });
          return;
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetHref);
      }
    })
  );
});

