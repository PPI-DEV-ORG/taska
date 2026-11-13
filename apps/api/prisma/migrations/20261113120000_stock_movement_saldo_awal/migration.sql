-- Kategori mutasi khusus pencatatan stok awal saat produk baru dibuat.
ALTER TABLE `StockMovement`
  MODIFY `category` ENUM(
    'PENERIMAAN_SUPPLIER',
    'KELUAR_PROJECT',
    'KELUAR_SURAT_JALAN',
    'TRANSFER',
    'RETUR_PROJECT',
    'BARANG_TERPAKAI',
    'PENGGANTIAN',
    'PENYESUAIAN_OPNAME',
    'SALDO_AWAL',
    'LAINNYA'
  ) NOT NULL;
