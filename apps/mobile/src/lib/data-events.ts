import * as React from "react";

/**
 * Bus perubahan data antar-komponen yang sedang tampil di layar.
 *
 * Dipancarkan oleh:
 *  - aksi lokal (mis. nota petty cash ditambah dari dialog) -> komponen lain langsung memuat ulang,
 *  - event realtime "data-change" dari server (perubahan oleh user lain), lewat app-store.
 *
 * Dipakai untuk data yang tidak disimpan di store global (mis. daftar petty cash per survey / proyek),
 * sehingga dua panel yang menampilkan data yang sama tetap sinkron tanpa refresh manual.
 */
type Listener = (module: string) => void;

const listeners = new Set<Listener>();

export function emitDataChange(module: string) {
  for (const l of [...listeners]) {
    try {
      l(module);
    } catch {
      /* listener rusak tidak boleh menghentikan listener lain */
    }
  }
}

/** Panggil `onChange` setiap kali salah satu `modules` berubah. */
export function useDataChange(modules: readonly string[], onChange: () => void) {
  const cb = React.useRef(onChange);
  // Selalu pakai callback terbaru tanpa mendaftar ulang listener
  React.useEffect(() => {
    cb.current = onChange;
  });
  const key = modules.join("|");
  React.useEffect(() => {
    const wanted = new Set(key.split("|"));
    const listener: Listener = (m) => {
      if (wanted.has(m)) cb.current();
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, [key]);
}
