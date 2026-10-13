import { Platform } from "react-native";
import type { Notif } from "@/constants/modules";
import { normalizeNotifHref } from "@/services/adapters";

const CHANNEL_ID = "taska-realtime";
const TITLE = "Taska Mini ERP";

let permission: NotificationPermission | null = null;
let nativeReady = false;
let nativeModPromise: Promise<typeof import("expo-notifications") | null> | null = null;

/** Muat expo-notifications hanya di iOS/Android agar Web tidak memicu warning auto-registration push token. */
async function getNativeNotifications(): Promise<typeof import("expo-notifications") | null> {
  if (Platform.OS !== "ios" && Platform.OS !== "android") return null;
  if (!nativeModPromise) {
    nativeModPromise = import("expo-notifications").catch(() => null);
  }
  return nativeModPromise;
}

/** Label judul native per kategori notifikasi. */
const JENIS_LABEL: Record<Notif["jenis"], string> = {
  approval: "Persetujuan",
  stok: "Stok",
  pengiriman: "Pengiriman",
  lead: "Lead",
  tugas: "Tugas",
  surat: "Surat jalan",
};

/** Pasang handler agar notifikasi tampil saat app foreground di iOS/Android. */
async function ensureNativeHandler(): Promise<typeof import("expo-notifications") | null> {
  const Notifications = await getNativeNotifications();
  if (!Notifications) return null;
  if (!nativeReady) {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
    nativeReady = true;
  }
  return Notifications;
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

  const Notifications = await ensureNativeHandler();
  if (!Notifications) return false;
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

/** Pasang listener saat user mengetuk banner notifikasi di iOS/Android untuk navigasi ke halaman terkait. */
export async function subscribeNotificationTap(onNavigate: (href: string) => void): Promise<() => void> {
  if (Platform.OS !== "ios" && Platform.OS !== "android") return () => {};
  const Notifications = await ensureNativeHandler();
  if (!Notifications) return () => {};
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    const rawHref = response?.notification?.request?.content?.data?.href;
    if (typeof rawHref === "string" && rawHref.trim()) {
      onNavigate(normalizeNotifHref(rawHref));
    }
  });
  return () => sub.remove();
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
  const href = normalizeNotifHref(opts.href ?? opts.notif?.href ?? "");

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

  const Notifications = await ensureNativeHandler();
  if (!Notifications) return;
  const ok = await ensureNotifPermission();
  if (!ok) return;
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title, body, data: { href } },
      trigger:
        Platform.OS === "android"
          ? { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 1, channelId: CHANNEL_ID }
          : null,
    });
  } catch {
    // Fallback jika versi SDK menerima trigger: null langsung
    try {
      await Notifications.scheduleNotificationAsync({
        content: { title, body, data: { href } },
        trigger: null,
      });
    } catch {}
  }
}

