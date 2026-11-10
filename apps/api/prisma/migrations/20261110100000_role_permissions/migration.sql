-- Hak akses per peran yang bisa diatur Super Admin (menggantikan matriks yang hardcoded sebagai sumber kebenaran).
-- Baris diisi otomatis dari matriks bawaan saat API start (tidak menimpa pengaturan yang sudah diubah).

CREATE TABLE `RolePermission` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `role` ENUM('SUPER_ADMIN', 'ADMIN', 'BOS', 'SALES', 'PM', 'TEKNISI', 'PROCUREMENT', 'FINANCE', 'GUDANG', 'SE', 'HR') NOT NULL,
    `module` VARCHAR(191) NOT NULL,
    `actions` VARCHAR(191) NOT NULL DEFAULT '',
    `updatedById` INTEGER NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `RolePermission_role_idx`(`role`),
    UNIQUE INDEX `RolePermission_role_module_key`(`role`, `module`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

