-- AlterTable: dokumen project (BAHP, BAST, DO) disimpan di level project, bukan hanya task.
ALTER TABLE `Project`
    ADD COLUMN `bahpFileId` INTEGER NULL,
    ADD COLUMN `bastFileId` INTEGER NULL,
    ADD COLUMN `doFileId` INTEGER NULL;

