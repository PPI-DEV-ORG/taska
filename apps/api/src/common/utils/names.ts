/**
 * Normalisasi nama master (supplier, customer, produk) sebelum dicari / disimpan:
 * spasi di awal/akhir dibuang dan spasi ganda dirapatkan. Perbandingan huruf besar/kecil sudah ditangani
 * collation database (utf8mb4_unicode_ci), sehingga "PT  Abc " dan "pt abc" dianggap nama yang sama.
 */
export function cleanName(v: unknown): string {
  return String(v ?? "").replace(/\s+/g, " ").trim();
}
