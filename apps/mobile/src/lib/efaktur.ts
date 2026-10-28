/**
 * Generator CSV Faktur Pajak Keluaran resmi aplikasi e-Faktur Direktorat Jenderal Pajak (DJP).
 * Format mengacu pada petunjuk teknis DJP:
 * Record FK (Faktur Keluaran) & Record OF (Objek Faktur)
 */
export function buildEfakturCsv(
  invoices: any[],
  customers: any[] = [],
  options?: { nsfpStart?: string }
): string {
  const header = [
    "FK,KD_JENIS_TRANSAKSI,FG_PENGGANTI,NOMOR_FAKTUR,MASA_PAJAK,TAHUN_PAJAK,TANGGAL_FAKTUR,NPWP,NAMA,ALAMAT_LENGKAP,JUMLAH_DPP,JUMLAH_PPN,JUMLAH_PPNBM,ID_KETERANGAN_TAMBAHAN,FG_UANG_MUKA,UANG_MUKA_DPP,UANG_MUKA_PPN,UANG_MUKA_PPNBM,REFERENSI,KODE_DOKUMEN_PENDUKUNG",
    "OF,KODE_OBJEK,NAMA,HARGA_SATUAN,JUMLAH_BARANG,HARGA_TOTAL,DISKON,DPP,PPN,TARIF_PPNBM,PPNBM",
  ];

  const lines: string[] = [header[0]!, header[1]!];

  let currentNsfpNum = 1;
  let nsfpPrefix = "";
  if (options?.nsfpStart) {
    const match = options.nsfpStart.match(/^(.*?)(\d{8})$/);
    if (match && match[1] && match[2]) {
      nsfpPrefix = match[1];
      currentNsfpNum = parseInt(match[2], 10);
    }
  }

  const validInvoices = invoices.filter(
    (inv) => inv && inv.status !== "Batal" && inv.status !== "BATAL"
  );

  for (let i = 0; i < validInvoices.length; i++) {
    const inv = validInvoices[i];
    const rawDate = inv.tanggal || inv.date || new Date().toISOString().slice(0, 10);
    const d = new Date(rawDate);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = String(d.getFullYear());
    const tanggalFaktur = `${day}/${month}/${year}`;
    const masaPajak = String(d.getMonth() + 1);

    let noFaktur = "";
    if (nsfpPrefix) {
      noFaktur = `${nsfpPrefix}${String(currentNsfpNum++).padStart(8, "0")}`;
    } else {
      noFaktur = `010000${year.slice(-2)}${String(i + 1).padStart(8, "0")}`;
    }

    const custObj = customers.find(
      (c) =>
        String(c.id) === String(inv.customerId) ||
        c.nama === inv.customer ||
        c.name === inv.customer
    );

    let npwp = "0000000000000000";
    const notes = custObj?.notes || custObj?.alamat || inv.catatan || "";
    const npwpMatch = String(notes).match(/npwp\s*[:=]?\s*([0-9.\-]+)/i);
    if (npwpMatch && npwpMatch[1]) {
      const cleaned = npwpMatch[1].replace(/\D/g, "");
      if (cleaned.length >= 15) {
        npwp = cleaned.slice(0, 16);
      }
    }

    const nama = String(custObj?.nama || custObj?.name || inv.customer || "Customer").replace(/"/g, '""');
    const alamat = String(custObj?.alamat || custObj?.address || "Indonesia").replace(/"/g, '""');
    const dpp = Math.round(Number(inv.nilai || inv.amount || (inv.total ? inv.total / 1.11 : 0)));
    const ppn = Math.round(Number(inv.ppn) || dpp * 0.11);
    const isDp = String(inv.jenis || inv.type).toUpperCase() === "DP";
    const referensi = String(inv.nomor || inv.number || `INV-${i + 1}`).replace(/"/g, '""');

    // FK row
    lines.push(
      `"FK","01","0","${noFaktur}","${masaPajak}","${year}","${tanggalFaktur}","${npwp}","${nama}","${alamat}",${dpp},${ppn},0,"",${isDp ? 1 : 0},0,0,0,"${referensi}",""`
    );

    // OF row
    const itemDesc = String(inv.deskripsi || inv.keterangan || "Pengadaan Barang & Jasa").replace(/"/g, '""');
    lines.push(
      `"OF","000000","${itemDesc}",${dpp},1,${dpp},0,${dpp},${ppn},0,0`
    );
  }

  return lines.join("\r\n");
}

