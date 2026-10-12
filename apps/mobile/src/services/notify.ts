import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import type { Notif } from "@/mock/data";

const CHANNEL_ID = "taska-realtime";
const TITLE = "Taska Mini ERP";

let permission: NotificationPermission | null = null;
let nativeReady = false;

/** Label judul native per kategori notifikasi. */
const JENIS_LABEL: Record<Notif["jenis"], string> = {
  approval: "Persetujuan",
  stok: "Stok",
  pengiriman: "Pengiriman",
  lead: "Lead",
  tugas: "Tugas",
  surat: "Surat jalan",
};

/** Pasang handler agar notifikasi tampil saat app foreground (wajib di SDK 57). */
function ensureNativeHandler(): void {
  if (nativeReady || Platform.OS !== "ios" && Platform.OS !== "android") return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
  nativeReady = true;
}

/** Minta izin notifikasi OS/browser (web + native). */
export async function ensureNotifPermission(): Promise<boolean> {
  if (Platform.OS === "web") {
    if (typeof Notification === "undefined") return false;
    if (Notification.permission === "granted") {
      permission = "granted";
      return true;
    }
    if (Notification.permission === "denied") {
      permission = "denied";
      return false;
    }
    try {
      permission = await Notification.requestPermission();
    } catch {
      permission = "denied";
    }
    return permission === "granted";
  }

  if (Platform.OS !== "ios" && Platform.OS !== "android") return false;
  ensureNativeHandler();
  try {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: "Notifikasi Taska",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#FF231F7C",
      });
    }
    const cur = await Notifications.getPermissionsAsync();
    if (cur.granted || cur.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) {
      return true;
    }
    const req = await Notifications.requestPermissionsAsync();
    return !!req.granted;
  } catch {
    return false;
  }
}

/** Tampilkan notifikasi OS/browser (web: Notification API; native: expo-notifications). */
export async function showSystemNotification(opts: {
  title?: string;
  body?: string;
  tag?: string;
  href?: string;
  notif?: Notif;
}): Promise<void> {
  const title = opts.title ?? (opts.notif ? JENIS_LABEL[opts.notif.jenis] : TITLE);
  const body = opts.body ?? opts.notif?.teks ?? "";
  const href = opts.href ?? opts.notif?.href ?? "";

  if (Platform.OS === "web") {
    if (typeof Notification === "undefined") return;
    if (Notification.permission !== "granted") {
      const ok = await ensureNotifPermission();
      if (!ok) return;
    }
    try {
      const n = new Notification(title, { body, tag: opts.tag } as NotificationOptions);
      if (href) {
        n.onclick = () => {
          window.focus();
          window.location.assign(href);
          n.close();
        };
      }
    } catch {
      // browser melempar bila dipanggil tanpa user gesture — abaikan
    }
    return;
  }

  if (Platform.OS !== "ios" && Platform.OS !== "android") return;
  ensureNativeHandler();
  const ok = await ensureNotifPermission();
  if (!ok) return;
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title, body, data: { href } },
      trigger: Platform.OS === "android" ? { channelId: CHANNEL_ID } : null,
    });
  } catch {
    // abaikan (permission bisa berubah di tengah jalan)
  }
}
