-- Menyamakan database dengan schema.prisma.
-- Sebelumnya ~33 foreign key (Poc, Kunjungan, Kalender, Reservasi Stok, COA, Tag Supplier, dst.) dan 4 indeks belum ada,
-- sehingga data bisa menunjuk ke dokumen yang sudah dihapus. Sebelum dibuat, semua foreign key sudah dicek: tidak ada baris yatim.

-- DropForeignKey
ALTER TABLE `ClientPO` DROP FOREIGN KEY `ClientPO_customerId_fkey`;

-- DropForeignKey
ALTER TABLE `PurchaseRequestItem` DROP FOREIGN KEY `PurchaseRequestItem_productId_fkey`;

-- DropForeignKey
ALTER TABLE `Receiving` DROP FOREIGN KEY `Receiving_supplierPoId_fkey`;

-- DropForeignKey
ALTER TABLE `StockReservation` DROP FOREIGN KEY `StockReservation_projectId_fkey`;

-- DropForeignKey
ALTER TABLE `SupplierPOItem` DROP FOREIGN KEY `SupplierPOItem_productId_fkey`;

-- DropIndex
DROP INDEX `PurchaseRequestItem_productId_fkey` ON `PurchaseRequestItem`;

-- DropIndex
DROP INDEX `SupplierPOItem_productId_fkey` ON `SupplierPOItem`;

-- AlterTable
ALTER TABLE `Attendance` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `AuditLog` MODIFY `detail` TEXT NULL;

-- AlterTable
ALTER TABLE `CalendarEvent` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `CoaAccount` MODIFY `code` VARCHAR(191) NOT NULL,
    MODIFY `normalBalance` VARCHAR(191) NOT NULL DEFAULT 'DEBIT',
    MODIFY `type` VARCHAR(191) NULL,
    MODIFY `parentCode` VARCHAR(191) NULL,
    MODIFY `status` VARCHAR(191) NOT NULL DEFAULT 'AKTIF',
    ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `DeliveryNoteItem` MODIFY `serials` LONGTEXT NULL;

-- AlterTable
ALTER TABLE `PayrollSlip` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `PocChecklist` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `PocReport` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `ProjectRequirement` MODIFY `serials` LONGTEXT NULL;

-- AlterTable
ALTER TABLE `PurchaseRequest` MODIFY `procurementSource` VARCHAR(191) NULL DEFAULT 'SUPPLIER',
    MODIFY `paymentMethod` VARCHAR(191) NULL DEFAULT 'UTANG';

-- AlterTable
ALTER TABLE `PurchaseRequestItem` MODIFY `serials` LONGTEXT NULL,
    MODIFY `customUnit` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `Receiving` MODIFY `conditionNote` TEXT NULL;

-- AlterTable
ALTER TABLE `ReceivingItem` MODIFY `note` TEXT NULL,
    MODIFY `serials` LONGTEXT NULL;

-- AlterTable
ALTER TABLE `SalaryConfig` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `Supplier` MODIFY `taxStatus` VARCHAR(191) NULL DEFAULT 'NON_PKP';

-- AlterTable
ALTER TABLE `SupplierPOItem` MODIFY `customUnit` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `Task` MODIFY `status` ENUM('TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'REJECTED', 'PENDING', 'TESTED') NOT NULL DEFAULT 'TODO';

-- AlterTable
ALTER TABLE `VisitActionItem` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `VisitActivityType` MODIFY `status` ENUM('AKTIF', 'NONAKTIF') NOT NULL DEFAULT 'AKTIF';

-- AlterTable
ALTER TABLE `VisitReport` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- CreateIndex
CREATE INDEX `Expense_pocReportId_idx` ON `Expense`(`pocReportId`);

-- CreateIndex
CREATE INDEX `Expense_visitReportId_idx` ON `Expense`(`visitReportId`);

-- CreateIndex
CREATE INDEX `FollowUp_pocReportId_idx` ON `FollowUp`(`pocReportId`);

-- CreateIndex
CREATE INDEX `FollowUp_visitReportId_idx` ON `FollowUp`(`visitReportId`);

-- AddForeignKey
ALTER TABLE `SupplierItemTag` ADD CONSTRAINT `SupplierItemTag_supplierId_fkey` FOREIGN KEY (`supplierId`) REFERENCES `Supplier`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FollowUp` ADD CONSTRAINT `FollowUp_pocReportId_fkey` FOREIGN KEY (`pocReportId`) REFERENCES `PocReport`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FollowUp` ADD CONSTRAINT `FollowUp_visitReportId_fkey` FOREIGN KEY (`visitReportId`) REFERENCES `VisitReport`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ClientPO` ADD CONSTRAINT `ClientPO_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Expense` ADD CONSTRAINT `Expense_pocReportId_fkey` FOREIGN KEY (`pocReportId`) REFERENCES `PocReport`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Expense` ADD CONSTRAINT `Expense_visitReportId_fkey` FOREIGN KEY (`visitReportId`) REFERENCES `VisitReport`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PurchaseRequestItem` ADD CONSTRAINT `PurchaseRequestItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SupplierPOItem` ADD CONSTRAINT `SupplierPOItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Receiving` ADD CONSTRAINT `Receiving_supplierPoId_fkey` FOREIGN KEY (`supplierPoId`) REFERENCES `SupplierPO`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockReservation` ADD CONSTRAINT `StockReservation_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockReservation` ADD CONSTRAINT `StockReservation_quotationId_fkey` FOREIGN KEY (`quotationId`) REFERENCES `Quotation`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockReservation` ADD CONSTRAINT `StockReservation_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `InvoiceOut`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockReservation` ADD CONSTRAINT `StockReservation_purchaseRequestId_fkey` FOREIGN KEY (`purchaseRequestId`) REFERENCES `PurchaseRequest`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PocReport` ADD CONSTRAINT `PocReport_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PocReport` ADD CONSTRAINT `PocReport_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PocReport` ADD CONSTRAINT `PocReport_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `Lead`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PocReport` ADD CONSTRAINT `PocReport_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PocMember` ADD CONSTRAINT `PocMember_pocReportId_fkey` FOREIGN KEY (`pocReportId`) REFERENCES `PocReport`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PocMember` ADD CONSTRAINT `PocMember_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PocChecklist` ADD CONSTRAINT `PocChecklist_pocReportId_fkey` FOREIGN KEY (`pocReportId`) REFERENCES `PocReport`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VisitReport` ADD CONSTRAINT `VisitReport_activityTypeId_fkey` FOREIGN KEY (`activityTypeId`) REFERENCES `VisitActivityType`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VisitReport` ADD CONSTRAINT `VisitReport_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VisitReport` ADD CONSTRAINT `VisitReport_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `Lead`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VisitReport` ADD CONSTRAINT `VisitReport_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VisitReport` ADD CONSTRAINT `VisitReport_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VisitMember` ADD CONSTRAINT `VisitMember_visitReportId_fkey` FOREIGN KEY (`visitReportId`) REFERENCES `VisitReport`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VisitMember` ADD CONSTRAINT `VisitMember_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VisitActionItem` ADD CONSTRAINT `VisitActionItem_visitReportId_fkey` FOREIGN KEY (`visitReportId`) REFERENCES `VisitReport`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CalendarEvent` ADD CONSTRAINT `CalendarEvent_creatorId_fkey` FOREIGN KEY (`creatorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CalendarEvent` ADD CONSTRAINT `CalendarEvent_assigneeId_fkey` FOREIGN KEY (`assigneeId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CalendarAttendee` ADD CONSTRAINT `CalendarAttendee_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `CalendarEvent`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CalendarAttendee` ADD CONSTRAINT `CalendarAttendee_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CoaAccount` ADD CONSTRAINT `CoaAccount_parentCode_fkey` FOREIGN KEY (`parentCode`) REFERENCES `CoaAccount`(`code`) ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER TABLE `Expense` RENAME INDEX `Expense_surveyId_fkey` TO `Expense_surveyId_idx`;

