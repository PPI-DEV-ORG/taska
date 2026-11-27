CREATE TABLE IF NOT EXISTS `user_push_tokens` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `userId` INTEGER NOT NULL,
  `token` VARCHAR(255) NOT NULL,
  `platform` VARCHAR(32) NOT NULL DEFAULT 'android',
  `deviceName` VARCHAR(120) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `user_push_tokens_token_key`(`token`),
  INDEX `user_push_tokens_userId_idx`(`userId`),
  CONSTRAINT `user_push_tokens_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
