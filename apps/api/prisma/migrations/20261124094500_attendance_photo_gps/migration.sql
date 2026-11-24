-- AlterTable
ALTER TABLE `Attendance`
  ADD COLUMN `checkInPhotoFileId` INTEGER NULL,
  ADD COLUMN `checkInLatitude` DOUBLE NULL,
  ADD COLUMN `checkInLongitude` DOUBLE NULL,
  ADD COLUMN `checkInAccuracy` DOUBLE NULL,
  ADD COLUMN `checkInDistanceMeters` DOUBLE NULL,
  ADD COLUMN `checkInLocationStatus` VARCHAR(191) NULL,
  ADD COLUMN `checkInAddress` VARCHAR(191) NULL,
  ADD COLUMN `checkOutPhotoFileId` INTEGER NULL,
  ADD COLUMN `checkOutLatitude` DOUBLE NULL,
  ADD COLUMN `checkOutLongitude` DOUBLE NULL,
  ADD COLUMN `checkOutAccuracy` DOUBLE NULL,
  ADD COLUMN `checkOutDistanceMeters` DOUBLE NULL,
  ADD COLUMN `checkOutLocationStatus` VARCHAR(191) NULL,
  ADD COLUMN `checkOutAddress` VARCHAR(191) NULL,
  ADD COLUMN `lateMinutes` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `verificationStatus` VARCHAR(191) NOT NULL DEFAULT 'TERVERIFIKASI',
  ADD COLUMN `verifiedById` INTEGER NULL,
  ADD COLUMN `verifiedAt` DATETIME(3) NULL;

-- CreateIndex
CREATE INDEX `Attendance_verificationStatus_idx` ON `Attendance`(`verificationStatus`);
