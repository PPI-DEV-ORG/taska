-- Langkah 1 kebersihan data: foreign key untuk semua kolom ID yang sebelumnya "lepas", nama Supplier/Customer unik,
-- nomor tagihan supplier unik per supplier, dan relasi AuditLog.userId yang dobel (selalu kosong) dihapus.
--
-- Bagian A membersihkan data dulu agar constraint bisa dipasang di database mana pun (termasuk produksi):
--   * ID yang menunjuk data/file yang sudah tidak ada -> NULL
--   * baris yang user-nya sudah terhapus -> dipindah ke user placeholder "Pengguna Terhapus" (riwayat tetap ada)
--   * nama/nomor duplikat -> diberi akhiran " (#id)" agar mudah dicari & digabung manual (lihat pnpm db:audit)

-- ───────────── A1. Referensi yatim -> NULL ─────────────
UPDATE `Payment` x LEFT JOIN `User` r ON r.`id` = x.`createdById` SET x.`createdById` = NULL WHERE x.`createdById` IS NOT NULL AND r.`id` IS NULL;
UPDATE `ApprovalStep` x LEFT JOIN `User` r ON r.`id` = x.`decidedById` SET x.`decidedById` = NULL WHERE x.`decidedById` IS NOT NULL AND r.`id` IS NULL;
UPDATE `Expense` x LEFT JOIN `User` r ON r.`id` = x.`paidById` SET x.`paidById` = NULL WHERE x.`paidById` IS NOT NULL AND r.`id` IS NULL;
UPDATE `DeliveryNote` x LEFT JOIN `User` r ON r.`id` = x.`receiveById` SET x.`receiveById` = NULL WHERE x.`receiveById` IS NOT NULL AND r.`id` IS NULL;
UPDATE `VisitActionItem` x LEFT JOIN `User` r ON r.`id` = x.`assigneeId` SET x.`assigneeId` = NULL WHERE x.`assigneeId` IS NOT NULL AND r.`id` IS NULL;
UPDATE `PocChecklist` x LEFT JOIN `User` r ON r.`id` = x.`assigneeId` SET x.`assigneeId` = NULL WHERE x.`assigneeId` IS NOT NULL AND r.`id` IS NULL;
UPDATE `SerialUnitHistory` x LEFT JOIN `Warehouse` r ON r.`id` = x.`warehouseId` SET x.`warehouseId` = NULL WHERE x.`warehouseId` IS NOT NULL AND r.`id` IS NULL;
UPDATE `SerialUnitHistory` x LEFT JOIN `Project` r ON r.`id` = x.`projectId` SET x.`projectId` = NULL WHERE x.`projectId` IS NOT NULL AND r.`id` IS NULL;
UPDATE `StockMovement` x LEFT JOIN `Receiving` r ON r.`id` = x.`receivingId` SET x.`receivingId` = NULL WHERE x.`receivingId` IS NOT NULL AND r.`id` IS NULL;
UPDATE `StockReservation` x LEFT JOIN `ProjectRequirement` r ON r.`id` = x.`requirementId` SET x.`requirementId` = NULL WHERE x.`requirementId` IS NOT NULL AND r.`id` IS NULL;
UPDATE `InvoiceOut` x LEFT JOIN `InvoiceOut` r ON r.`id` = x.`parentInvoiceId` SET x.`parentInvoiceId` = NULL WHERE x.`parentInvoiceId` IS NOT NULL AND r.`id` IS NULL;
UPDATE `Quotation` x LEFT JOIN `PurchaseRequest` r ON r.`id` = x.`emergencyPrId` SET x.`emergencyPrId` = NULL WHERE x.`emergencyPrId` IS NOT NULL AND r.`id` IS NULL;
UPDATE `InvoiceOut` x LEFT JOIN `PurchaseRequest` r ON r.`id` = x.`emergencyPrId` SET x.`emergencyPrId` = NULL WHERE x.`emergencyPrId` IS NOT NULL AND r.`id` IS NULL;
UPDATE `CalendarEvent` x LEFT JOIN `Customer` r ON r.`id` = x.`customerId` SET x.`customerId` = NULL WHERE x.`customerId` IS NOT NULL AND r.`id` IS NULL;
UPDATE `CalendarEvent` x LEFT JOIN `Project` r ON r.`id` = x.`projectId` SET x.`projectId` = NULL WHERE x.`projectId` IS NOT NULL AND r.`id` IS NULL;
UPDATE `CalendarEvent` x LEFT JOIN `Lead` r ON r.`id` = x.`leadId` SET x.`leadId` = NULL WHERE x.`leadId` IS NOT NULL AND r.`id` IS NULL;
UPDATE `CalendarEvent` x LEFT JOIN `InvoiceOut` r ON r.`id` = x.`invoiceId` SET x.`invoiceId` = NULL WHERE x.`invoiceId` IS NOT NULL AND r.`id` IS NULL;
UPDATE `CalendarEvent` x LEFT JOIN `Supplier` r ON r.`id` = x.`supplierId` SET x.`supplierId` = NULL WHERE x.`supplierId` IS NOT NULL AND r.`id` IS NULL;
UPDATE `PurchaseRequest` x LEFT JOIN `File` r ON r.`id` = x.`evidenceFileId` SET x.`evidenceFileId` = NULL WHERE x.`evidenceFileId` IS NOT NULL AND r.`id` IS NULL;
UPDATE `PurchaseRequest` x LEFT JOIN `File` r ON r.`id` = x.`doFileId` SET x.`doFileId` = NULL WHERE x.`doFileId` IS NOT NULL AND r.`id` IS NULL;
UPDATE `PurchaseRequest` x LEFT JOIN `File` r ON r.`id` = x.`paymentProofFileId` SET x.`paymentProofFileId` = NULL WHERE x.`paymentProofFileId` IS NOT NULL AND r.`id` IS NULL;
UPDATE `SupplierPO` x LEFT JOIN `File` r ON r.`id` = x.`fileId` SET x.`fileId` = NULL WHERE x.`fileId` IS NOT NULL AND r.`id` IS NULL;
UPDATE `SupplierPO` x LEFT JOIN `File` r ON r.`id` = x.`doFileId` SET x.`doFileId` = NULL WHERE x.`doFileId` IS NOT NULL AND r.`id` IS NULL;
UPDATE `SupplierPO` x LEFT JOIN `File` r ON r.`id` = x.`soFileId` SET x.`soFileId` = NULL WHERE x.`soFileId` IS NOT NULL AND r.`id` IS NULL;
UPDATE `Receiving` x LEFT JOIN `File` r ON r.`id` = x.`receiptFileId` SET x.`receiptFileId` = NULL WHERE x.`receiptFileId` IS NOT NULL AND r.`id` IS NULL;
UPDATE `Receiving` x LEFT JOIN `File` r ON r.`id` = x.`photoFileId` SET x.`photoFileId` = NULL WHERE x.`photoFileId` IS NOT NULL AND r.`id` IS NULL;
UPDATE `InvoiceIn` x LEFT JOIN `File` r ON r.`id` = x.`fileId` SET x.`fileId` = NULL WHERE x.`fileId` IS NOT NULL AND r.`id` IS NULL;
UPDATE `InvoiceIn` x LEFT JOIN `File` r ON r.`id` = x.`transferFileId` SET x.`transferFileId` = NULL WHERE x.`transferFileId` IS NOT NULL AND r.`id` IS NULL;
UPDATE `InvoiceOut` x LEFT JOIN `File` r ON r.`id` = x.`fileId` SET x.`fileId` = NULL WHERE x.`fileId` IS NOT NULL AND r.`id` IS NULL;
UPDATE `InvoiceOut` x LEFT JOIN `File` r ON r.`id` = x.`paidFileId` SET x.`paidFileId` = NULL WHERE x.`paidFileId` IS NOT NULL AND r.`id` IS NULL;
UPDATE `InvoiceOut` x LEFT JOIN `File` r ON r.`id` = x.`latestFileId` SET x.`latestFileId` = NULL WHERE x.`latestFileId` IS NOT NULL AND r.`id` IS NULL;
UPDATE `Payment` x LEFT JOIN `File` r ON r.`id` = x.`fileId` SET x.`fileId` = NULL WHERE x.`fileId` IS NOT NULL AND r.`id` IS NULL;
UPDATE `ClientPO` x LEFT JOIN `File` r ON r.`id` = x.`fileId` SET x.`fileId` = NULL WHERE x.`fileId` IS NOT NULL AND r.`id` IS NULL;
UPDATE `ClientPO` x LEFT JOIN `File` r ON r.`id` = x.`soFileId` SET x.`soFileId` = NULL WHERE x.`soFileId` IS NOT NULL AND r.`id` IS NULL;
UPDATE `ClientPO` x LEFT JOIN `File` r ON r.`id` = x.`paymentProofFileId` SET x.`paymentProofFileId` = NULL WHERE x.`paymentProofFileId` IS NOT NULL AND r.`id` IS NULL;
UPDATE `Expense` x LEFT JOIN `File` r ON r.`id` = x.`receiptFileId` SET x.`receiptFileId` = NULL WHERE x.`receiptFileId` IS NOT NULL AND r.`id` IS NULL;
UPDATE `Expense` x LEFT JOIN `File` r ON r.`id` = x.`paidFileId` SET x.`paidFileId` = NULL WHERE x.`paidFileId` IS NOT NULL AND r.`id` IS NULL;
UPDATE `Project` x LEFT JOIN `File` r ON r.`id` = x.`prdFileId` SET x.`prdFileId` = NULL WHERE x.`prdFileId` IS NOT NULL AND r.`id` IS NULL;
UPDATE `Project` x LEFT JOIN `File` r ON r.`id` = x.`bahpFileId` SET x.`bahpFileId` = NULL WHERE x.`bahpFileId` IS NOT NULL AND r.`id` IS NULL;
UPDATE `Project` x LEFT JOIN `File` r ON r.`id` = x.`bastFileId` SET x.`bastFileId` = NULL WHERE x.`bastFileId` IS NOT NULL AND r.`id` IS NULL;
UPDATE `Project` x LEFT JOIN `File` r ON r.`id` = x.`doFileId` SET x.`doFileId` = NULL WHERE x.`doFileId` IS NOT NULL AND r.`id` IS NULL;
UPDATE `Project` x LEFT JOIN `File` r ON r.`id` = x.`boqFileId` SET x.`boqFileId` = NULL WHERE x.`boqFileId` IS NOT NULL AND r.`id` IS NULL;
UPDATE `Task` x LEFT JOIN `File` r ON r.`id` = x.`bahpFileId` SET x.`bahpFileId` = NULL WHERE x.`bahpFileId` IS NOT NULL AND r.`id` IS NULL;
UPDATE `Task` x LEFT JOIN `File` r ON r.`id` = x.`bastFileId` SET x.`bastFileId` = NULL WHERE x.`bastFileId` IS NOT NULL AND r.`id` IS NULL;
UPDATE `Task` x LEFT JOIN `File` r ON r.`id` = x.`doFileId` SET x.`doFileId` = NULL WHERE x.`doFileId` IS NOT NULL AND r.`id` IS NULL;
UPDATE `Quotation` x LEFT JOIN `File` r ON r.`id` = x.`latestFileId` SET x.`latestFileId` = NULL WHERE x.`latestFileId` IS NOT NULL AND r.`id` IS NULL;
UPDATE `QuotationVersion` x LEFT JOIN `File` r ON r.`id` = x.`fileId` SET x.`fileId` = NULL WHERE x.`fileId` IS NOT NULL AND r.`id` IS NULL;
UPDATE `IssueReport` x LEFT JOIN `File` r ON r.`id` = x.`fileId` SET x.`fileId` = NULL WHERE x.`fileId` IS NOT NULL AND r.`id` IS NULL;
UPDATE `DamageReport` x LEFT JOIN `File` r ON r.`id` = x.`fileId` SET x.`fileId` = NULL WHERE x.`fileId` IS NOT NULL AND r.`id` IS NULL;
UPDATE `DeliveryNote` x LEFT JOIN `File` r ON r.`id` = x.`scanFileId` SET x.`scanFileId` = NULL WHERE x.`scanFileId` IS NOT NULL AND r.`id` IS NULL;
UPDATE `DeliveryNote` x LEFT JOIN `File` r ON r.`id` = x.`reportFileId` SET x.`reportFileId` = NULL WHERE x.`reportFileId` IS NOT NULL AND r.`id` IS NULL;
UPDATE `PocReport` x LEFT JOIN `File` r ON r.`id` = x.`logoFileId` SET x.`logoFileId` = NULL WHERE x.`logoFileId` IS NOT NULL AND r.`id` IS NULL;
UPDATE `PocReport` x LEFT JOIN `File` r ON r.`id` = x.`documentFileId` SET x.`documentFileId` = NULL WHERE x.`documentFileId` IS NOT NULL AND r.`id` IS NULL;
UPDATE `VisitReport` x LEFT JOIN `File` r ON r.`id` = x.`logoFileId` SET x.`logoFileId` = NULL WHERE x.`logoFileId` IS NOT NULL AND r.`id` IS NULL;
UPDATE `VisitReport` x LEFT JOIN `File` r ON r.`id` = x.`documentFileId` SET x.`documentFileId` = NULL WHERE x.`documentFileId` IS NOT NULL AND r.`id` IS NULL;

-- ───────────── A2. Baris dengan user yang sudah dihapus -> user placeholder ─────────────
SET @orphans = (
  (SELECT COUNT(*) FROM `Attendance` x LEFT JOIN `User` u ON u.`id` = x.`userId` WHERE u.`id` IS NULL)
  + (SELECT COUNT(*) FROM `PayrollSlip` x LEFT JOIN `User` u ON u.`id` = x.`userId` WHERE u.`id` IS NULL)
  + (SELECT COUNT(*) FROM `SalaryConfig` x LEFT JOIN `User` u ON u.`id` = x.`userId` WHERE u.`id` IS NULL)
  + (SELECT COUNT(*) FROM `PocReport` x LEFT JOIN `User` u ON u.`id` = x.`createdById` WHERE u.`id` IS NULL)
  + (SELECT COUNT(*) FROM `VisitReport` x LEFT JOIN `User` u ON u.`id` = x.`createdById` WHERE u.`id` IS NULL)
);
INSERT INTO `User` (`email`, `passwordHash`, `name`, `role`, `status`, `createdAt`, `updatedAt`)
SELECT 'pengguna-terhapus@system.local', '!', 'Pengguna Terhapus', 'TEKNISI', 'NONAKTIF', NOW(3), NOW(3)
FROM DUAL WHERE @orphans > 0 AND NOT EXISTS (SELECT 1 FROM `User` WHERE `email` = 'pengguna-terhapus@system.local');
SET @ghost = (SELECT `id` FROM `User` WHERE `email` = 'pengguna-terhapus@system.local' LIMIT 1);
UPDATE `Attendance` x LEFT JOIN `User` u ON u.`id` = x.`userId` SET x.`userId` = @ghost WHERE u.`id` IS NULL AND @ghost IS NOT NULL;
UPDATE `PayrollSlip` x LEFT JOIN `User` u ON u.`id` = x.`userId` SET x.`userId` = @ghost WHERE u.`id` IS NULL AND @ghost IS NOT NULL;
DELETE x FROM `SalaryConfig` x LEFT JOIN `User` u ON u.`id` = x.`userId` WHERE u.`id` IS NULL;
UPDATE `PocReport` x LEFT JOIN `User` u ON u.`id` = x.`createdById` SET x.`createdById` = @ghost WHERE u.`id` IS NULL AND @ghost IS NOT NULL;
UPDATE `VisitReport` x LEFT JOIN `User` u ON u.`id` = x.`createdById` SET x.`createdById` = @ghost WHERE u.`id` IS NULL AND @ghost IS NOT NULL;

-- ───────────── A3. Duplikat -> akhiran " (#id)" (data tidak dihapus) ─────────────
UPDATE `Supplier` s JOIN (SELECT MIN(`id`) AS keepId, `name` FROM `Supplier` GROUP BY `name` HAVING COUNT(*) > 1) d
  ON s.`name` = d.`name` AND s.`id` <> d.keepId
  SET s.`name` = LEFT(CONCAT(TRIM(s.`name`), ' (#', s.`id`, ')'), 191);
UPDATE `Customer` c JOIN (SELECT MIN(`id`) AS keepId, `name` FROM `Customer` GROUP BY `name` HAVING COUNT(*) > 1) d
  ON c.`name` = d.`name` AND c.`id` <> d.keepId
  SET c.`name` = LEFT(CONCAT(TRIM(c.`name`), ' (#', c.`id`, ')'), 191);
UPDATE `InvoiceIn` i JOIN (
    SELECT MIN(`id`) AS keepId, `supplierId`, `number` FROM `InvoiceIn` WHERE `number` IS NOT NULL
    GROUP BY `supplierId`, `number` HAVING COUNT(*) > 1
  ) d ON i.`supplierId` = d.`supplierId` AND i.`number` = d.`number` AND i.`id` <> d.keepId
  SET i.`number` = LEFT(CONCAT(i.`number`, ' (#', i.`id`, ')'), 191);

-- ───────────── B. Perubahan skema ─────────────

-- DropForeignKey
ALTER TABLE `AuditLog` DROP FOREIGN KEY `AuditLog_userId_fkey`;

-- DropIndex
DROP INDEX `AuditLog_userId_fkey` ON `AuditLog`;

-- DropIndex
DROP INDEX `Customer_name_idx` ON `Customer`;

-- DropIndex
DROP INDEX `Supplier_name_idx` ON `Supplier`;

-- AlterTable
ALTER TABLE `AccountMapping` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `ApprovalStep` MODIFY `approverRole` ENUM('SUPER_ADMIN', 'ADMIN', 'BOS', 'SALES', 'PM', 'TEKNISI', 'PROCUREMENT', 'FINANCE', 'GUDANG', 'SE', 'HR') NOT NULL;

-- AlterTable
ALTER TABLE `AuditLog` DROP COLUMN `userId`;

-- AlterTable
ALTER TABLE `ManualJournal` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `Notification` MODIFY `targetRole` ENUM('SUPER_ADMIN', 'ADMIN', 'BOS', 'SALES', 'PM', 'TEKNISI', 'PROCUREMENT', 'FINANCE', 'GUDANG', 'SE', 'HR') NULL;

-- AlterTable
ALTER TABLE `User` MODIFY `role` ENUM('SUPER_ADMIN', 'ADMIN', 'BOS', 'SALES', 'PM', 'TEKNISI', 'PROCUREMENT', 'FINANCE', 'GUDANG', 'SE', 'HR') NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `Customer_name_key` ON `Customer`(`name`);

-- CreateIndex
CREATE UNIQUE INDEX `InvoiceIn_supplierId_number_key` ON `InvoiceIn`(`supplierId`, `number`);

-- CreateIndex
CREATE UNIQUE INDEX `Supplier_name_key` ON `Supplier`(`name`);

-- AddForeignKey
ALTER TABLE `ApprovalStep` ADD CONSTRAINT `ApprovalStep_decidedById_fkey` FOREIGN KEY (`decidedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Quotation` ADD CONSTRAINT `Quotation_latestFileId_fkey` FOREIGN KEY (`latestFileId`) REFERENCES `File`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Quotation` ADD CONSTRAINT `Quotation_emergencyPrId_fkey` FOREIGN KEY (`emergencyPrId`) REFERENCES `PurchaseRequest`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuotationVersion` ADD CONSTRAINT `QuotationVersion_fileId_fkey` FOREIGN KEY (`fileId`) REFERENCES `File`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ClientPO` ADD CONSTRAINT `ClientPO_fileId_fkey` FOREIGN KEY (`fileId`) REFERENCES `File`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ClientPO` ADD CONSTRAINT `ClientPO_soFileId_fkey` FOREIGN KEY (`soFileId`) REFERENCES `File`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ClientPO` ADD CONSTRAINT `ClientPO_paymentProofFileId_fkey` FOREIGN KEY (`paymentProofFileId`) REFERENCES `File`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InvoiceOut` ADD CONSTRAINT `InvoiceOut_fileId_fkey` FOREIGN KEY (`fileId`) REFERENCES `File`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InvoiceOut` ADD CONSTRAINT `InvoiceOut_parentInvoiceId_fkey` FOREIGN KEY (`parentInvoiceId`) REFERENCES `InvoiceOut`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InvoiceOut` ADD CONSTRAINT `InvoiceOut_paidFileId_fkey` FOREIGN KEY (`paidFileId`) REFERENCES `File`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InvoiceOut` ADD CONSTRAINT `InvoiceOut_emergencyPrId_fkey` FOREIGN KEY (`emergencyPrId`) REFERENCES `PurchaseRequest`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InvoiceOut` ADD CONSTRAINT `InvoiceOut_latestFileId_fkey` FOREIGN KEY (`latestFileId`) REFERENCES `File`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InvoiceIn` ADD CONSTRAINT `InvoiceIn_fileId_fkey` FOREIGN KEY (`fileId`) REFERENCES `File`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InvoiceIn` ADD CONSTRAINT `InvoiceIn_transferFileId_fkey` FOREIGN KEY (`transferFileId`) REFERENCES `File`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_fileId_fkey` FOREIGN KEY (`fileId`) REFERENCES `File`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Expense` ADD CONSTRAINT `Expense_receiptFileId_fkey` FOREIGN KEY (`receiptFileId`) REFERENCES `File`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Expense` ADD CONSTRAINT `Expense_paidFileId_fkey` FOREIGN KEY (`paidFileId`) REFERENCES `File`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Expense` ADD CONSTRAINT `Expense_paidById_fkey` FOREIGN KEY (`paidById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Project` ADD CONSTRAINT `Project_prdFileId_fkey` FOREIGN KEY (`prdFileId`) REFERENCES `File`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Project` ADD CONSTRAINT `Project_bahpFileId_fkey` FOREIGN KEY (`bahpFileId`) REFERENCES `File`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Project` ADD CONSTRAINT `Project_bastFileId_fkey` FOREIGN KEY (`bastFileId`) REFERENCES `File`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Project` ADD CONSTRAINT `Project_doFileId_fkey` FOREIGN KEY (`doFileId`) REFERENCES `File`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Project` ADD CONSTRAINT `Project_boqFileId_fkey` FOREIGN KEY (`boqFileId`) REFERENCES `File`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Task` ADD CONSTRAINT `Task_bahpFileId_fkey` FOREIGN KEY (`bahpFileId`) REFERENCES `File`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Task` ADD CONSTRAINT `Task_bastFileId_fkey` FOREIGN KEY (`bastFileId`) REFERENCES `File`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Task` ADD CONSTRAINT `Task_doFileId_fkey` FOREIGN KEY (`doFileId`) REFERENCES `File`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PurchaseRequest` ADD CONSTRAINT `PurchaseRequest_evidenceFileId_fkey` FOREIGN KEY (`evidenceFileId`) REFERENCES `File`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PurchaseRequest` ADD CONSTRAINT `PurchaseRequest_doFileId_fkey` FOREIGN KEY (`doFileId`) REFERENCES `File`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PurchaseRequest` ADD CONSTRAINT `PurchaseRequest_paymentProofFileId_fkey` FOREIGN KEY (`paymentProofFileId`) REFERENCES `File`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SupplierPO` ADD CONSTRAINT `SupplierPO_fileId_fkey` FOREIGN KEY (`fileId`) REFERENCES `File`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SupplierPO` ADD CONSTRAINT `SupplierPO_doFileId_fkey` FOREIGN KEY (`doFileId`) REFERENCES `File`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SupplierPO` ADD CONSTRAINT `SupplierPO_soFileId_fkey` FOREIGN KEY (`soFileId`) REFERENCES `File`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Receiving` ADD CONSTRAINT `Receiving_receiptFileId_fkey` FOREIGN KEY (`receiptFileId`) REFERENCES `File`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Receiving` ADD CONSTRAINT `Receiving_photoFileId_fkey` FOREIGN KEY (`photoFileId`) REFERENCES `File`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `IssueReport` ADD CONSTRAINT `IssueReport_fileId_fkey` FOREIGN KEY (`fileId`) REFERENCES `File`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockMovement` ADD CONSTRAINT `StockMovement_receivingId_fkey` FOREIGN KEY (`receivingId`) REFERENCES `Receiving`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SerialUnitHistory` ADD CONSTRAINT `SerialUnitHistory_warehouseId_fkey` FOREIGN KEY (`warehouseId`) REFERENCES `Warehouse`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SerialUnitHistory` ADD CONSTRAINT `SerialUnitHistory_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockReservation` ADD CONSTRAINT `StockReservation_requirementId_fkey` FOREIGN KEY (`requirementId`) REFERENCES `ProjectRequirement`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DamageReport` ADD CONSTRAINT `DamageReport_fileId_fkey` FOREIGN KEY (`fileId`) REFERENCES `File`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DeliveryNote` ADD CONSTRAINT `DeliveryNote_receiveById_fkey` FOREIGN KEY (`receiveById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DeliveryNote` ADD CONSTRAINT `DeliveryNote_scanFileId_fkey` FOREIGN KEY (`scanFileId`) REFERENCES `File`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DeliveryNote` ADD CONSTRAINT `DeliveryNote_reportFileId_fkey` FOREIGN KEY (`reportFileId`) REFERENCES `File`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Attendance` ADD CONSTRAINT `Attendance_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SalaryConfig` ADD CONSTRAINT `SalaryConfig_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PayrollSlip` ADD CONSTRAINT `PayrollSlip_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PocReport` ADD CONSTRAINT `PocReport_logoFileId_fkey` FOREIGN KEY (`logoFileId`) REFERENCES `File`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PocReport` ADD CONSTRAINT `PocReport_documentFileId_fkey` FOREIGN KEY (`documentFileId`) REFERENCES `File`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PocReport` ADD CONSTRAINT `PocReport_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PocChecklist` ADD CONSTRAINT `PocChecklist_assigneeId_fkey` FOREIGN KEY (`assigneeId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VisitReport` ADD CONSTRAINT `VisitReport_logoFileId_fkey` FOREIGN KEY (`logoFileId`) REFERENCES `File`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VisitReport` ADD CONSTRAINT `VisitReport_documentFileId_fkey` FOREIGN KEY (`documentFileId`) REFERENCES `File`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VisitReport` ADD CONSTRAINT `VisitReport_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VisitActionItem` ADD CONSTRAINT `VisitActionItem_assigneeId_fkey` FOREIGN KEY (`assigneeId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CalendarEvent` ADD CONSTRAINT `CalendarEvent_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CalendarEvent` ADD CONSTRAINT `CalendarEvent_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CalendarEvent` ADD CONSTRAINT `CalendarEvent_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `Lead`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CalendarEvent` ADD CONSTRAINT `CalendarEvent_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `InvoiceOut`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CalendarEvent` ADD CONSTRAINT `CalendarEvent_supplierId_fkey` FOREIGN KEY (`supplierId`) REFERENCES `Supplier`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
