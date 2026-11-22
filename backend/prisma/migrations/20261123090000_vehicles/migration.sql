-- AlterTable
ALTER TABLE `documents` MODIFY `kind` ENUM('NID', 'AGREEMENT', 'PHOTO', 'UTILITY', 'OTHER', 'REGISTRATION', 'FITNESS', 'TAX_TOKEN', 'ROUTE_PERMIT', 'INSURANCE', 'LICENCE', 'ENLISTMENT') NOT NULL DEFAULT 'OTHER';

-- AlterTable
ALTER TABLE `invoices` MODIFY `flatId` BIGINT NULL;

-- CreateTable
CREATE TABLE `vehicles` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `orgId` BIGINT NOT NULL,
    `assetId` BIGINT NOT NULL,
    `type` ENUM('CNG', 'TAXI', 'CAR', 'MICROBUS', 'OTHER') NOT NULL,
    `regNo` VARCHAR(50) NOT NULL,
    `model` VARCHAR(100) NULL,
    `year` INTEGER NULL,
    `color` VARCHAR(30) NULL,
    `chassisNo` VARCHAR(50) NULL,
    `engineNo` VARCHAR(50) NULL,
    `rate` DECIMAL(12, 2) NULL,
    `status` ENUM('AVAILABLE', 'ON_LEASE', 'OFF_ROAD') NOT NULL DEFAULT 'AVAILABLE',
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `vehicles_assetId_key`(`assetId`),
    UNIQUE INDEX `vehicles_orgId_regNo_key`(`orgId`, `regNo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `day_entries` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `agreementId` BIGINT NOT NULL,
    `date` DATE NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `reason` VARCHAR(255) NULL,
    `createdById` BIGINT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `day_entries_agreementId_date_key`(`agreementId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `vehicles` ADD CONSTRAINT `vehicles_orgId_fkey` FOREIGN KEY (`orgId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vehicles` ADD CONSTRAINT `vehicles_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `assets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `day_entries` ADD CONSTRAINT `day_entries_agreementId_fkey` FOREIGN KEY (`agreementId`) REFERENCES `agreements`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `day_entries` ADD CONSTRAINT `day_entries_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `memberships`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

