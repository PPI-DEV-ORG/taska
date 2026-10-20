-- AlterTable: tambah deskripsi pada Task project
ALTER TABLE `Task` ADD COLUMN `description` TEXT NULL;

-- AlterTable: tambah SI (Sistem Integrator) pada enum ClientType
ALTER TABLE `Lead` MODIFY COLUMN `clientType` ENUM('PARTNER', 'END_USER', 'SI') NOT NULL DEFAULT 'END_USER';

