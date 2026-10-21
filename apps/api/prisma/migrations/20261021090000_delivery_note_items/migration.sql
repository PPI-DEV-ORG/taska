-- CreateTable
CREATE TABLE `DeliveryNoteItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `deliveryNoteId` INTEGER NOT NULL,
    `productId` INTEGER NOT NULL,
    `qty` INTEGER NOT NULL DEFAULT 1,
    `serials` TEXT NULL,
    `note` VARCHAR(191) NULL,

    INDEX `DeliveryNoteItem_deliveryNoteId_idx`(`deliveryNoteId`),
    INDEX `DeliveryNoteItem_productId_idx`(`productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `DeliveryNoteItem` ADD CONSTRAINT `DeliveryNoteItem_deliveryNoteId_fkey` FOREIGN KEY (`deliveryNoteId`) REFERENCES `DeliveryNote`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DeliveryNoteItem` ADD CONSTRAINT `DeliveryNoteItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

