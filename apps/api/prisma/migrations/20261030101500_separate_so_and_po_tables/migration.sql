-- Migrasi pemisahan Sales Order (SO) dan Purchase Order (PO)
-- Memindahkan seluruh record PO dari ClientPO ke SupplierPO, sehingga ClientPO murni hanya berisi SO
INSERT INTO `SupplierPO` (`number`, `supplierId`, `total`, `date`, `paymentTerms`, `status`, `shipmentStatus`, `fileId`, `createdById`, `createdAt`, `updatedAt`)
SELECT 
  c.number,
  COALESCE(c.supplierId, (SELECT id FROM `Supplier` WHERE status = 'AKTIF' ORDER BY id ASC LIMIT 1), (SELECT id FROM `Supplier` ORDER BY id ASC LIMIT 1)),
  c.amount,
  c.date,
  'Tempo / Utang',
  'DI_SUPPLIER',
  'DI_SUPPLIER',
  c.fileId,
  (SELECT id FROM `User` WHERE role IN ('ADMIN', 'BOS', 'PROCUREMENT', 'FINANCE') ORDER BY id ASC LIMIT 1),
  c.createdAt,
  c.updatedAt
FROM `ClientPO` c
WHERE (c.number LIKE 'PO/%' OR c.number LIKE 'POD/%' OR c.number LIKE 'PO-%')
  AND c.number NOT IN (SELECT number FROM `SupplierPO`);

-- Putus relasi InvoiceOut ke ClientPO yang berjenis PO
UPDATE `InvoiceOut` 
SET `clientPoId` = NULL 
WHERE `clientPoId` IN (
  SELECT id FROM (SELECT id FROM `ClientPO` WHERE number LIKE 'PO/%' OR number LIKE 'POD/%' OR number LIKE 'PO-%') as tmp
);

-- Hapus record PO dari tabel ClientPO agar ClientPO murni hanya berisi Sales Order (SO)
DELETE FROM `ClientPO` WHERE number LIKE 'PO/%' OR number LIKE 'POD/%' OR number LIKE 'PO-%';

