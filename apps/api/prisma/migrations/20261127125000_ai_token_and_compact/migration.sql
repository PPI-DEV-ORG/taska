ALTER TABLE `ai_chat_sessions`
  ADD COLUMN `summary` LONGTEXT NULL,
  ADD COLUMN `compactedUpToMessageId` INTEGER NULL,
  ADD COLUMN `compactedAt` DATETIME(3) NULL;

ALTER TABLE `ai_chat_messages`
  ADD COLUMN `promptTokens` INTEGER NULL,
  ADD COLUMN `completionTokens` INTEGER NULL,
  ADD COLUMN `totalTokens` INTEGER NULL,
  ADD COLUMN `modelUsed` VARCHAR(120) NULL;

CREATE INDEX `ai_chat_messages_createdAt_idx` ON `ai_chat_messages`(`createdAt`);
