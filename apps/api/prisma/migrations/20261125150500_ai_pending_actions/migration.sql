-- CreateTable: AI Pending Actions (Human-in-the-Loop Create Confirmation)

CREATE TABLE IF NOT EXISTS `ai_pending_actions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sessionId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `entityType` VARCHAR(48) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `summaryJson` LONGTEXT NOT NULL,
    `payloadJson` LONGTEXT NOT NULL,
    `status` VARCHAR(24) NOT NULL DEFAULT 'PENDING',
    `resultEntityId` VARCHAR(64) NULL,
    `resultHref` VARCHAR(191) NULL,
    `errorMessage` TEXT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ai_pending_actions_sessionId_status_idx`(`sessionId`, `status`),
    INDEX `ai_pending_actions_userId_status_idx`(`userId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ai_pending_actions`
    ADD CONSTRAINT `ai_pending_actions_sessionId_fkey`
    FOREIGN KEY (`sessionId`) REFERENCES `ai_chat_sessions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
