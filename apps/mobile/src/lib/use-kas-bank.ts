import * as React from "react";
import { fetchAccounts } from "@/services/api";
import { getKasBankAccounts } from "@/lib/accounting";

export type KasBankOption = { code: string; name: string; rawName: string };

/**
 * Daftar akun kas/bank diambil dari COA di database (satu sumber dengan jurnal), bukan dari daftar bawaan aplikasi.
 * Hasil di-cache sekali per sesi; sebelum data server tiba dipakai daftar lokal sebagai cadangan.
 */
let cache: KasBankOption[] | null = null;
let inflight: Promise<KasBankOption[]> | null = null;

function load(): Promise<KasBankOption[]> {
  if (cache) return Promise.resolve(cache);
  if (!inflight) {
    inflight = fetchAccounts({ cash: true, postable: true })
      .then((rows) => {
        const list = (Array.isArray(rows) ? rows : [])
          .filter((a: any) => a && a.code && (a.status ?? "AKTIF") === "AKTIF")
          .map((a: any) => ({ code: String(a.code), name: `${a.name} [${a.code}]`, rawName: String(a.name) }));
        if (list.length) cache = list;
        return list.length ? list : getKasBankAccounts();
      })
      .catch(() => getKasBankAccounts())
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export function useKasBankAccounts(): KasBankOption[] {
  const [list, setList] = React.useState<KasBankOption[]>(() => cache ?? getKasBankAccounts());
  React.useEffect(() => {
    let alive = true;
    void load().then((l) => {
      if (alive) setList(l);
    });
    return () => {
      alive = false;
    };
  }, []);
  return list;
}

/** Panggil setelah akun COA ditambah / diubah agar daftar dimuat ulang. */
export function invalidateKasBankAccounts() {
  cache = null;
}
