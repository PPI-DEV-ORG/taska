import { Platform } from "react-native";
import type { Notif } from "@/constants/modules";
import { normalizeNotifHref } from "@/services/adapters";
import { apiOrigin, getAccess } from "@/services/api";

const CHANNEL_ID = "taska-realtime";
const TITLE = "Taska Mini ERP";

let permission: NotificationPermission | null = null;
let nativeReady = false;
let nativeModPromise: Promise<typeof import("expo-notifications") | null> | null = null;
let audioCtx: AudioContext | null = null;
let fallbackWavUrl: string | null = null;
let webListenersBound = false;
let swRegistration: ServiceWorkerRegistration | null = null;

/** Label judul per kategori notifikasi. */
export const JENIS_LABEL: Record<Notif["jenis"], string> = {
  approval: "Persetujuan Dokumen",
  stok: "Update Stok & Gudang",
  pengiriman: "Update Pengiriman",
  lead: "Prospek & Penawaran",
  tugas: "Tugas & Project",
  surat: "Surat Jalan & Dokumen",
};

/** Buat WAV data URI untuk fallback suara "ting" bila AudioContext belum di-unlock. */
function getFallbackTingWav(): string {
  if (fallbackWavUrl) return fallbackWavUrl;
  try {
    const sampleRate = 22050;
    const duration = 0.45;
    const numSamples = Math.floor(sampleRate * duration);
    const buffer = new ArrayBuffer(44 + numSamples * 2);
    const view = new DataView(buffer);

    const writeStr = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
    };

    writeStr(0, "RIFF");
    view.setUint32(4, 36 + numSamples * 2, true);
    writeStr(8, "WAVE");
    writeStr(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeStr(36, "data");
    view.setUint32(40, numSamples * 2, true);

    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      // Nada lonceng "ting" dua harmonik (B5 -> E6 dengan peluruhan eksponensial halus)
      const freq = t < 0.07 ? 987.77 : 1318.51;
      const env = Math.exp(-t * 7.5);
      const wave =
        Math.sin(2 * Math.PI * freq * t) * 0.65 +
        Math.sin(2 * Math.PI * (freq * 2) * t) * 0.25 * Math.exp(-t * 12);
      const sample = Math.max(-1, Math.min(1, wave * env * 0.55));
      view.setInt16(44 + i * 2, sample * 32767, true);
    }

    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]!);
    fallbackWavUrl = `data:audio/wav;base64,${btoa(binary)}`;
    return fallbackWavUrl;
  } catch {
    return "";
  }
}

/** Mainkan efek suara "*ting*" saat notifikasi baru masuk. */
export function playNotificationSound(): void {
  if (Platform.OS !== "web" || typeof window === "undefined") return;
  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (Ctx) {
      if (!audioCtx) audioCtx = new Ctx();
      if (audioCtx && audioCtx.state === "suspended") {
        void audioCtx.resume().catch(() => {});
      }
      if (audioCtx && audioCtx.state === "running") {
        const now = audioCtx.currentTime;

        // Nada 1 (B5 - 987.77Hz)
        const osc1 = audioCtx.createOscillator();
        const gain1 = audioCtx.createGain();
        osc1.type = "sine";
        osc1.frequency.setValueAtTime(987.77, now);
        osc1.frequency.exponentialRampToValueAtTime(1318.51, now + 0.08);
        gain1.gain.setValueAtTime(0.001, now);
        gain1.gain.linearRampToValueAtTime(0.28, now + 0.015);
        gain1.gain.exponentialRampToValueAtTime(0.0008, now + 0.52);
        osc1.connect(gain1);
        gain1.connect(audioCtx.destination);
        osc1.start(now);
        osc1.stop(now + 0.55);

        // Harmonik lonceng "ting" (E6 - 1318.51Hz & B6 - 1975.53Hz)
        const osc2 = audioCtx.createOscillator();
        const gain2 = audioCtx.createGain();
        osc2.type = "triangle";
        osc2.frequency.setValueAtTime(1318.51, now + 0.05);
        osc2.frequency.setValueAtTime(1975.53, now + 0.09);
        gain2.gain.setValueAtTime(0.001, now + 0.05);
        gain2.gain.linearRampToValueAtTime(0.18, now + 0.07);
        gain2.gain.exponentialRampToValueAtTime(0.0005, now + 0.48);
        osc2.connect(gain2);
        gain2.connect(audioCtx.destination);
        osc2.start(now + 0.05);
        osc2.stop(now + 0.5);
        return;
      }
    }
  } catch {}

  // Fallback menggunakan HTML5 Audio WAV bila AudioContext belum aktif
  try {
    const wav = getFallbackTingWav();
    if (wav && typeof Audio !== "undefined") {
      const a = new Audio(wav);
      a.volume = 0.6;
      void a.play().catch(() => {});
    }
  } catch {}
}

/** Sinkronkan token & daftar ID notifikasi yang sudah dilihat ke Service Worker (untuk background OS notif). */
export function syncServiceWorkerAuth(seenIds?: string[]): void {
  if (Platform.OS !== "web" || typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  const token = getAccess();
  const origin = apiOrigin();
  const send = (target: ServiceWorker | null | undefined) => {
    if (!target) return;
    try {
      target.postMessage({
        type: "SET_AUTH",
        token,
        apiOrigin: origin,
        seenIds: seenIds ?? [],
      });
    } catch {}
  };
  if (navigator.serviceWorker.controller) {
    send(navigator.serviceWorker.controller);
  } else if (swRegistration?.active) {
    send(swRegistration.active);
  }
}

/** Tandai ID notifikasi sudah diproses agar Service Worker tidak menduplikasi OS notif. */
export function markServiceWorkerSeen(id: string | number): void {
  if (Platform.OS !== "web" || typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  const ctrl = navigator.serviceWorker.controller ?? swRegistration?.active;
  try {
    ctrl?.postMessage({ type: "MARK_SEEN", id: String(id) });
  } catch {}
}

/** Inisialisasi Service Worker & auto-unlock AudioContext + izin notifikasi di Web. */
export function initWebNotificationRuntime(onNavigate?: (href: string) => void): void {
  if (Platform.OS !== "web" || typeof window === "undefined") return;

  if ("serviceWorker" in navigator && !swRegistration) {
    navigator.serviceWorker
      .register("/sw-notif.js")
      .then((reg) => {
        swRegistration = reg;
        syncServiceWorkerAuth();
      })
      .catch(() => {});

    navigator.serviceWorker.addEventListener("message", (event) => {
      const data = event.data;
      if (data?.type === "NAVIGATE_NOTIF" && typeof data.href === "string") {
        const cleanHref = normalizeNotifHref(data.href);
        if (onNavigate) onNavigate(cleanHref);
        else window.location.assign(cleanHref);
      }
    });
  }

  if (!webListenersBound) {
    webListenersBound = true;
    const unlockOnGesture = () => {
      try {
        const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (Ctx && !audioCtx) audioCtx = new Ctx();
        if (audioCtx && audioCtx.state === "suspended") {
          void audioCtx.resume().catch(() => {});
        }
      } catch {}
      if (typeof Notification !== "undefined" && Notification.permission === "default") {
        void Notification.requestPermission().then((p) => {
          permission = p;
        }).catch(() => {});
      }
    };
    window.addEventListener("pointerdown", unlockOnGesture, { passive: true });
    window.addEventListener("keydown", unlockOnGesture, { passive: true });
    window.addEventListener("beforeunload", () => {
      syncServiceWorkerAuth();
    });
    document.addEventListener("visibilitychange", () => {
      syncServiceWorkerAuth();
    });
  }
}

/** Muat expo-notifications hanya di iOS/Android agar Web tidak memicu warning auto-registration push token. */
async function getNativeNotifications(): Promise<typeof import("expo-notifications") | null> {
  if (Platform.OS !== "ios" && Platform.OS !== "android") return null;
  if (!nativeModPromise) {
    nativeModPromise = import("expo-notifications").catch(() => null);
  }
  return nativeModPromise;
}

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
    initWebNotificationRuntime();
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
  if (Platform.OS === "web") {
    initWebNotificationRuntime(onNavigate);
    return () => {};
  }
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

/** Cek apakah tab browser sedang di-minimize, tidak fokus, atau di background (seperti WA-Web). */
export function isAppInBackground(): boolean {
  if (Platform.OS !== "web" || typeof document === "undefined") return false;
  return document.visibilityState !== "visible" || !document.hasFocus();
}

/** Tampilkan notifikasi OS/browser (web: Service Worker / Notification API seperti WA-Web; native: expo-notifications). */
export async function showSystemNotification(opts: {
  title?: string;
  body?: string;
  tag?: string;
  href?: string;
  notif?: Notif;
  onlyWhenBackground?: boolean;
}): Promise<void> {
  const title = opts.title ?? (opts.notif ? JENIS_LABEL[opts.notif.jenis] : TITLE);
  const body = opts.body ?? opts.notif?.teks ?? "";
  const href = normalizeNotifHref(opts.href ?? opts.notif?.href ?? "");
  const tag = opts.tag ?? (opts.notif?.id ? `taska-notif-${opts.notif.id}` : `taska-${Date.now()}`);

  if (Platform.OS === "web") {
    if (opts.notif?.id) markServiceWorkerSeen(opts.notif.id);
    // Jika onlyWhenBackground diset true, hanya tampilkan OS notification saat tab ditutup/minimize/unfocused seperti WA-Web
    if (opts.onlyWhenBackground && !isAppInBackground()) {
      return;
    }
    if (typeof Notification === "undefined") return;
    if (Notification.permission !== "granted") {
      const ok = await ensureNotifPermission();
      if (!ok) return;
    }
    try {
      // Gunakan Service Worker showNotification bila tersedia (agar persis seperti WA-Web di OS Notification Center)
      const reg =
        swRegistration ??
        ("serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration() : undefined);
      if (reg && typeof reg.showNotification === "function") {
        await reg.showNotification(title, {
          body,
          tag,
          renotify: true,
          data: { href },
        } as NotificationOptions);
        return;
      }
    } catch {}

    try {
      const n = new Notification(title, { body, tag } as NotificationOptions);
      if (href) {
        n.onclick = () => {
          window.focus();
          window.location.assign(href);
          n.close();
        };
      }
    } catch {
      // browser melempar bila dipanggil tanpa izin — abaikan
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
    try {
      await Notifications.scheduleNotificationAsync({
        content: { title, body, data: { href } },
        trigger: null,
      });
    } catch {}
  }
}
