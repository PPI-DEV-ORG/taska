import { Platform } from "react-native";
import * as Location from "expo-location";

export type GpsSnapshot = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  capturedAt: string;
};

/**
 * Ambil koordinat GPS perangkat secara presisi tinggi (Web Geolocation watchPosition & Native expo-location).
 * Mengambil beberapa sampel hingga mendapatkan akurasi terbaik (target ≤ 30 m, maks ~7 detik)
 * agar tidak hanya mengambil estimasi kasar pertama berbasis IP/tower.
 */
export async function captureCurrentGps(options?: {
  targetAccuracyMeters?: number;
  maxWaitMs?: number;
}): Promise<GpsSnapshot> {
  const targetAccuracy = options?.targetAccuracyMeters ?? 30;
  const maxWaitMs = options?.maxWaitMs ?? 7000;

  if (Platform.OS === "web") {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      throw new Error(
        "Browser ini tidak mendukung layanan lokasi GPS (pastikan memakai HTTPS).",
      );
    }

    return new Promise<GpsSnapshot>((resolve, reject) => {
      let best: GpsSnapshot | null = null;
      let settled = false;
      let watchId: number | null = null;
      let timer: ReturnType<typeof setTimeout> | null = null;

      const finish = (result?: GpsSnapshot, err?: Error) => {
        if (settled) return;
        settled = true;
        if (watchId !== null) {
          try {
            navigator.geolocation.clearWatch(watchId);
          } catch {}
        }
        if (timer !== null) clearTimeout(timer);
        if (result) resolve(result);
        else reject(err || new Error("Gagal mengambil lokasi GPS."));
      };

      const consider = (pos: GeolocationPosition) => {
        const acc = Number.isFinite(pos.coords.accuracy)
          ? Math.round(pos.coords.accuracy)
          : null;
        const snap: GpsSnapshot = {
          latitude: Number(pos.coords.latitude.toFixed(6)),
          longitude: Number(pos.coords.longitude.toFixed(6)),
          accuracy: acc,
          capturedAt: new Date(pos.timestamp || Date.now()).toISOString(),
        };
        if (
          !best ||
          (snap.accuracy !== null &&
            (best.accuracy === null || snap.accuracy < best.accuracy))
        ) {
          best = snap;
        }
        if (snap.accuracy !== null && snap.accuracy <= targetAccuracy) {
          finish(best);
        }
      };

      timer = setTimeout(() => {
        if (best) {
          finish(best);
        } else {
          finish(
            undefined,
            new Error(
              "Waktu pencarian GPS habis. Coba lagi di area dengan sinyal lebih baik.",
            ),
          );
        }
      }, maxWaitMs);

      watchId = navigator.geolocation.watchPosition(
        consider,
        (err) => {
          if (best) {
            finish(best);
            return;
          }
          if (err.code === 1) {
            finish(
              undefined,
              new Error(
                "Izin lokasi GPS ditolak. Aktifkan izin lokasi di pengaturan browser Anda.",
              ),
            );
          } else if (err.code === 2) {
            finish(
              undefined,
              new Error(
                "Sinyal GPS tidak tersedia. Pastikan layanan lokasi (GPS) perangkat aktif.",
              ),
            );
          } else if (err.code === 3) {
            finish(
              undefined,
              new Error(
                "Waktu pencarian GPS habis. Coba lagi di area dengan sinyal lebih baik.",
              ),
            );
          } else {
            finish(undefined, new Error(err.message || "Gagal mengambil lokasi GPS."));
          }
        },
        {
          enableHighAccuracy: true,
          timeout: maxWaitMs,
          maximumAge: 0,
        },
      );
    });
  }

  // Native Android / iOS via expo-location (akurasi tertinggi + sampling singkat)
  const perm = await Location.requestForegroundPermissionsAsync();
  if (perm.status !== "granted") {
    throw new Error(
      "Izin akses lokasi GPS diperlukan untuk melakukan absensi. Aktifkan di pengaturan perangkat.",
    );
  }

  const servicesEnabled = await Location.hasServicesEnabledAsync();
  if (!servicesEnabled) {
    throw new Error(
      "Layanan lokasi (GPS) perangkat sedang mati. Mohon aktifkan GPS terlebih dahulu.",
    );
  }

  let best: GpsSnapshot | null = null;
  let subscription: Location.LocationSubscription | null = null;

  try {
    await new Promise<void>((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        resolve();
      };
      const timer = setTimeout(finish, maxWaitMs);

      void Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 800,
          distanceInterval: 0,
        },
        (pos) => {
          const acc =
            typeof pos.coords.accuracy === "number" &&
            Number.isFinite(pos.coords.accuracy)
              ? Math.round(pos.coords.accuracy)
              : null;
          const snap: GpsSnapshot = {
            latitude: Number(pos.coords.latitude.toFixed(6)),
            longitude: Number(pos.coords.longitude.toFixed(6)),
            accuracy: acc,
            capturedAt: new Date(pos.timestamp || Date.now()).toISOString(),
          };
          if (
            !best ||
            (snap.accuracy !== null &&
              (best.accuracy === null || snap.accuracy < best.accuracy))
          ) {
            best = snap;
          }
          if (snap.accuracy !== null && snap.accuracy <= targetAccuracy) {
            clearTimeout(timer);
            finish();
          }
        },
      )
        .then((sub) => {
          subscription = sub;
          if (done) sub.remove();
        })
        .catch(() => {
          clearTimeout(timer);
          finish();
        });
    });
  } finally {
    if (subscription) {
      try {
        (subscription as Location.LocationSubscription).remove();
      } catch {}
    }
  }

  if (best) return best;

  // Fallback langsung getCurrentPositionAsync bila watchPosition belum sempat emit
  const pos = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Highest,
  });

  return {
    latitude: Number(pos.coords.latitude.toFixed(6)),
    longitude: Number(pos.coords.longitude.toFixed(6)),
    accuracy:
      typeof pos.coords.accuracy === "number" &&
      Number.isFinite(pos.coords.accuracy)
        ? Math.round(pos.coords.accuracy)
        : null,
    capturedAt: new Date(pos.timestamp || Date.now()).toISOString(),
  };
}

/** Hitung jarak Haversine dalam meter antara dua titik koordinat. */
export function haversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

export function formatDistanceLabel(meters: number | null | undefined): string {
  if (meters == null || !Number.isFinite(meters)) return "-";
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(2)} km`;
}

export function googleMapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

/**
 * Best-effort reverse geocoding dari koordinat GPS menjadi alamat terbaca.
 * Mengembalikan string kosong bila gagal/offline agar tidak menghambat proses absensi.
 */
export async function reverseGeocodeAddress(
  latitude: number,
  longitude: number,
): Promise<string> {
  try {
    if (Platform.OS !== "web") {
      const results = await Location.reverseGeocodeAsync({ latitude, longitude });
      const first = results?.[0];
      if (!first) return "";
      const parts = [
        first.name,
        first.street,
        first.district,
        first.subregion,
        first.city,
        first.region,
      ].filter((v, i, arr) => Boolean(v) && arr.indexOf(v) === i);
      return parts.join(", ");
    }

    // Web: OpenStreetMap Nominatim (best-effort, timeout 5 detik)
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(String(latitude))}&lon=${encodeURIComponent(String(longitude))}&accept-language=id`,
        {
          signal: controller.signal,
          headers: { Accept: "application/json" },
        },
      );
      if (!res.ok) return "";
      const data = await res.json();
      return typeof data?.display_name === "string" ? data.display_name : "";
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return "";
  }
}

export function formatLocationStatusLabel(status?: string | null): {
  label: string;
  tone: "success" | "info" | "warning" | "danger" | "neutral";
} {
  switch ((status || "").toUpperCase()) {
    case "DI_KANTOR":
      return { label: "Di Area Kantor", tone: "success" };
    case "LUAR_KANTOR_DINAS":
      return { label: "Luar Kantor (Dinas)", tone: "info" };
    case "DI_LUAR_RADIUS":
      return { label: "Di Luar Area Kantor", tone: "warning" };
    case "TERCATAT":
      return { label: "GPS Tercatat", tone: "info" };
    case "TANPA_GPS":
      return { label: "Tanpa GPS", tone: "danger" };
    default:
      return { label: "Belum Tercatat", tone: "neutral" };
  }
}
