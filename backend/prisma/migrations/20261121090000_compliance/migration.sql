-- AlterTable
ALTER TABLE `audit_logs` ADD COLUMN `orgId` BIGINT NULL;

-- AlterTable
ALTER TABLE `bill_types` ADD COLUMN `split` ENUM('EQUAL', 'PER_PERSON', 'PER_SQFT') NULL,
    MODIFY `calcMethod` ENUM('FIXED', 'METERED', 'SLAB', 'PER_PERSON', 'MANUAL', 'SHARED') NOT NULL;

-- AlterTable
ALTER TABLE `expenses` MODIFY `category` ENUM('LIFT', 'SECURITY', 'CLEANING', 'COMMON_ELECTRICITY', 'REPAIRS', 'MAINTENANCE', 'MISC', 'HOLDING_TAX', 'STAFF_SALARY') NOT NULL;

-- AlterTable
ALTER TABLE `payments` MODIFY `method` ENUM('CASH', 'BKASH', 'NAGAD', 'ROCKET', 'BANK', 'CHEQUE', 'DEPOSIT', 'TDS') NOT NULL;

-- CreateTable
CREATE TABLE `building_bills` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `orgId` BIGINT NOT NULL,
    `buildingId` BIGINT NOT NULL,
    `billTypeId` BIGINT NOT NULL,
    `month` INTEGER NOT NULL,
    `year` INTEGER NOT NULL,
    `total` DECIMAL(12, 2) NOT NULL,
    `note` VARCHAR(255) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `building_bills_orgId_year_month_idx`(`orgId`, `year`, `month`),
    UNIQUE INDEX `building_bills_buildingId_billTypeId_month_year_key`(`buildingId`, `billTypeId`, `month`, `year`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `maintenance_requests` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `orgId` BIGINT NOT NULL,
    `assetId` BIGINT NOT NULL,
    `tenantId` BIGINT NULL,
    `title` VARCHAR(200) NOT NULL,
    `description` TEXT NULL,
    `category` VARCHAR(50) NULL,
    `priority` VARCHAR(10) NOT NULL DEFAULT 'NORMAL',
    `status` ENUM('NEW', 'ASSIGNED', 'WAITING', 'IN_PROGRESS', 'DONE', 'CANCELLED') NOT NULL DEFAULT 'NEW',
    `assignedToId` BIGINT NULL,
    `createdById` BIGINT NULL,
    `cost` DECIMAL(12, 2) NULL,
    `expenseId` BIGINT NULL,
    `blocksUnit` BOOLEAN NOT NULL DEFAULT false,
    `resolvedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `maintenance_requests_orgId_status_idx`(`orgId`, `status`),
    INDEX `maintenance_requests_assetId_idx`(`assetId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `documents` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `orgId` BIGINT NOT NULL,
    `kind` ENUM('NID', 'AGREEMENT', 'PHOTO', 'UTILITY', 'OTHER') NOT NULL DEFAULT 'OTHER',
    `name` VARCHAR(200) NOT NULL,
    `path` VARCHAR(255) NOT NULL,
    `mime` VARCHAR(100) NULL,
    `size` INTEGER NULL,
    `tenantId` BIGINT NULL,
    `assetId` BIGINT NULL,
    `agreementId` BIGINT NULL,
    `maintenanceId` BIGINT NULL,
    `expiresAt` DATE NULL,
    `uploadedById` BIGINT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `documents_orgId_expiresAt_idx`(`orgId`, `expiresAt`),
    INDEX `documents_tenantId_idx`(`tenantId`),
    INDEX `documents_agreementId_idx`(`agreementId`),
    INDEX `documents_assetId_idx`(`assetId`),
    INDEX `documents_maintenanceId_idx`(`maintenanceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `audit_logs_orgId_createdAt_idx` ON `audit_logs`(`orgId`, `createdAt`);

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_orgId_fkey` FOREIGN KEY (`orgId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `building_bills` ADD CONSTRAINT `building_bills_orgId_fkey` FOREIGN KEY (`orgId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `building_bills` ADD CONSTRAINT `building_bills_buildingId_fkey` FOREIGN KEY (`buildingId`) REFERENCES `buildings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `building_bills` ADD CONSTRAINT `building_bills_billTypeId_fkey` FOREIGN KEY (`billTypeId`) REFERENCES `bill_types`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `maintenance_requests` ADD CONSTRAINT `maintenance_requests_orgId_fkey` FOREIGN KEY (`orgId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `maintenance_requests` ADD CONSTRAINT `maintenance_requests_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `assets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `maintenance_requests` ADD CONSTRAINT `maintenance_requests_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `maintenance_requests` ADD CONSTRAINT `maintenance_requests_assignedToId_fkey` FOREIGN KEY (`assignedToId`) REFERENCES `memberships`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `maintenance_requests` ADD CONSTRAINT `maintenance_requests_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `memberships`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `maintenance_requests` ADD CONSTRAINT `maintenance_requests_expenseId_fkey` FOREIGN KEY (`expenseId`) REFERENCES `expenses`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `documents` ADD CONSTRAINT `documents_orgId_fkey` FOREIGN KEY (`orgId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `documents` ADD CONSTRAINT `documents_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `documents` ADD CONSTRAINT `documents_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `assets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `documents` ADD CONSTRAINT `documents_agreementId_fkey` FOREIGN KEY (`agreementId`) REFERENCES `agreements`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `documents` ADD CONSTRAINT `documents_maintenanceId_fkey` FOREIGN KEY (`maintenanceId`) REFERENCES `maintenance_requests`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `documents` ADD CONSTRAINT `documents_uploadedById_fkey` FOREIGN KEY (`uploadedById`) REFERENCES `memberships`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;


-- Backfill: existing uploads (stored as absolute paths) become vault documents (file name only).
INSERT INTO `documents` (`orgId`, `kind`, `name`, `path`, `agreementId`, `assetId`, `tenantId`, `createdAt`)
SELECT a.`orgId`, 'AGREEMENT', 'Agreement',
       SUBSTRING_INDEX(SUBSTRING_INDEX(a.`documentPath`, CHAR(92), -1), '/', -1),
       a.`id`, a.`assetId`, a.`tenantId`, a.`updatedAt`
FROM `agreements` a WHERE a.`documentPath` IS NOT NULL AND a.`documentPath` <> '';

INSERT INTO `documents` (`orgId`, `kind`, `name`, `path`, `tenantId`, `createdAt`)
SELECT t.`orgId`, 'PHOTO', 'Photo',
       SUBSTRING_INDEX(SUBSTRING_INDEX(t.`photo`, CHAR(92), -1), '/', -1),
       t.`id`, t.`updatedAt`
FROM `tenants` t WHERE t.`photo` IS NOT NULL AND t.`photo` <> '';
