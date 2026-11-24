import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const memCache = new Map<string, string>();
let hydrated = false;
let hydratePromise: Promise<void> | null = null;

function hasWebStorage(): boolean {
  return Platform.OS === "web" && typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

/**
 * Muat seluruh key dari AsyncStorage ke memory cache sekali saat startup (native).
 * Di web langsung no-op karena window.localStorage sudah sinkron.
 */
export async function hydrateAppStorage(): Promise<void> {
  if (hasWebStorage() || hydrated) return;
  if (hydratePromise) return hydratePromise;
  hydratePromise = (async () => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      if (keys.length > 0) {
        const pairs = await AsyncStorage.multiGet(keys);
        for (const [k, v] of pairs) {
          if (v !== null && !memCache.has(k)) {
            memCache.set(k, v);
          }
        }
      }
    } catch {
      // Abaikan jika storage native tidak tersedia
    } finally {
      hydrated = true;
    }
  })();
  return hydratePromise;
}

export function getStorageItem(key: string): string | null {
  if (hasWebStorage()) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }
  return memCache.get(key) ?? null;
}

export function setStorageItem(key: string, value: string): void {
  if (hasWebStorage()) {
    try {
      window.localStorage.setItem(key, value);
    } catch {}
    return;
  }
  memCache.set(key, value);
  void AsyncStorage.setItem(key, value).catch(() => {});
}

export function removeStorageItem(key: string): void {
  if (hasWebStorage()) {
    try {
      window.localStorage.removeItem(key);
    } catch {}
    return;
  }
  memCache.delete(key);
  void AsyncStorage.removeItem(key).catch(() => {});
}

export function getStorageItemWithMigration(newKey: string, oldKey?: string): string | null {
  let raw = getStorageItem(newKey);
  if (!raw && oldKey) {
    raw = getStorageItem(oldKey);
    if (raw) {
      setStorageItem(newKey, raw);
      removeStorageItem(oldKey);
    }
  }
  return raw;
}
