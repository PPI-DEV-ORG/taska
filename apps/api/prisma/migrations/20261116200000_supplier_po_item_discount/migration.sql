-- Diskon per item PO Supplier (persen atau nominal), agar nilai baris setelah diskon
-- tersimpan dan total PO dihitung dari harga bersih.
ALTER TABLE `SupplierPOItem`
    ADD COLUMN `diskon` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `diskonPct` DECIMAL(5, 2) NULL;
