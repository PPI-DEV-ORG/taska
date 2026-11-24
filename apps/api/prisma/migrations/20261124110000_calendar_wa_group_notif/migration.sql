-- AlterTable: Extend CalendarEvent with location, client/contact info, and WhatsApp group & personal reminder fields
ALTER TABLE `CalendarEvent`
  ADD COLUMN `location` TEXT NULL,
  ADD COLUMN `companyName` VARCHAR(191) NULL,
  ADD COLUMN `contactPerson` VARCHAR(191) NULL,
  ADD COLUMN `notifyWhatsapp` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `whatsappTargetType` VARCHAR(191) NOT NULL DEFAULT 'GROUP',
  ADD COLUMN `whatsappGroupJid` VARCHAR(191) NULL,
  ADD COLUMN `whatsappPhone` VARCHAR(191) NULL,
  ADD COLUMN `waRemindedAt` DATETIME(3) NULL;
