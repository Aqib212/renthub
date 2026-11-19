-- DropForeignKey
ALTER TABLE `meter_readings` DROP FOREIGN KEY `meter_readings_flatId_fkey`;

-- DropForeignKey
ALTER TABLE `meter_readings` DROP FOREIGN KEY `meter_readings_ownerId_fkey`;

-- AlterTable
ALTER TABLE `flats` ADD COLUMN `sanctionedLoad` DECIMAL(8, 2) NULL;

-- AlterTable
ALTER TABLE `invoices` ADD COLUMN `carriedForward` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `shareToken` VARCHAR(64) NULL;

-- AlterTable
ALTER TABLE `tenants` ADD COLUMN `members` INTEGER NOT NULL DEFAULT 1;


-- CreateTable
CREATE TABLE `bill_types` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `ownerId` BIGINT NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `calcMethod` ENUM('FIXED', 'METERED', 'SLAB', 'PER_PERSON', 'MANUAL') NOT NULL,
    `rate` DECIMAL(12, 2) NULL,
    `unitLabel` VARCHAR(20) NULL,
    `slabs` JSON NULL,
    `fixedCharge` DECIMAL(10, 2) NULL,
    `demandChargePerKw` DECIMAL(10, 2) NULL,
    `vatPercent` DECIMAL(5, 2) NULL,
    `appliesToAll` BOOLEAN NOT NULL DEFAULT true,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `bill_types_ownerId_name_key`(`ownerId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `flat_charges` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `flatId` BIGINT NOT NULL,
    `billTypeId` BIGINT NOT NULL,
    `amount` DECIMAL(12, 2) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,

    INDEX `flat_charges_billTypeId_idx`(`billTypeId`),
    UNIQUE INDEX `flat_charges_flatId_billTypeId_key`(`flatId`, `billTypeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bill_entries` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `flatId` BIGINT NOT NULL,
    `billTypeId` BIGINT NOT NULL,
    `month` INTEGER NOT NULL,
    `year` INTEGER NOT NULL,
    `previousReading` DECIMAL(12, 2) NULL,
    `currentReading` DECIMAL(12, 2) NULL,
    `units` DECIMAL(12, 2) NULL,
    `amount` DECIMAL(12, 2) NULL,
    `note` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `bill_entries_billTypeId_idx`(`billTypeId`),
    UNIQUE INDEX `bill_entries_flatId_billTypeId_month_year_key`(`flatId`, `billTypeId`, `month`, `year`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `invoice_items` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `invoiceId` BIGINT NOT NULL,
    `billTypeId` BIGINT NULL,
    `label` VARCHAR(100) NOT NULL,
    `detail` VARCHAR(255) NULL,
    `quantity` DECIMAL(12, 2) NULL,
    `rate` DECIMAL(12, 2) NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,

    INDEX `invoice_items_invoiceId_idx`(`invoiceId`),
    INDEX `invoice_items_billTypeId_idx`(`billTypeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `invoices_shareToken_key` ON `invoices`(`shareToken`);

-- CreateIndex
CREATE UNIQUE INDEX `invoices_flatId_month_year_key` ON `invoices`(`flatId`, `month`, `year`);

-- DropIndex (the unique index above now backs the flatId foreign key)
DROP INDEX `invoices_flatId_month_year_idx` ON `invoices`;

-- AddForeignKey
ALTER TABLE `bill_types` ADD CONSTRAINT `bill_types_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `flat_charges` ADD CONSTRAINT `flat_charges_flatId_fkey` FOREIGN KEY (`flatId`) REFERENCES `flats`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `flat_charges` ADD CONSTRAINT `flat_charges_billTypeId_fkey` FOREIGN KEY (`billTypeId`) REFERENCES `bill_types`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bill_entries` ADD CONSTRAINT `bill_entries_flatId_fkey` FOREIGN KEY (`flatId`) REFERENCES `flats`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bill_entries` ADD CONSTRAINT `bill_entries_billTypeId_fkey` FOREIGN KEY (`billTypeId`) REFERENCES `bill_types`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoice_items` ADD CONSTRAINT `invoice_items_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `invoices`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoice_items` ADD CONSTRAINT `invoice_items_billTypeId_fkey` FOREIGN KEY (`billTypeId`) REFERENCES `bill_types`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;


-- ===== Move data: utility_configs -> bill_types =====
INSERT INTO `bill_types` (`ownerId`, `name`, `calcMethod`, `rate`, `unitLabel`, `slabs`, `fixedCharge`, `appliesToAll`, `isActive`, `sortOrder`, `updatedAt`)
SELECT uc.`ownerId`,
  CASE uc.`utilityType`
  WHEN 'ELECTRICITY' THEN 'Electricity' WHEN 'WATER' THEN 'Water' WHEN 'GAS' THEN 'Gas'
  WHEN 'SERVICE_CHARGE' THEN 'Service Charge' WHEN 'GARAGE' THEN 'Garage' WHEN 'LIFT' THEN 'Lift'
  WHEN 'GENERATOR' THEN 'Generator' WHEN 'SECURITY' THEN 'Security' WHEN 'CLEANING' THEN 'Cleaning'
  WHEN 'INTERNET' THEN 'Internet' END,
  CASE
    WHEN uc.`utilityType` = 'ELECTRICITY' AND uc.`slabConfig` IS NOT NULL THEN 'SLAB'
    WHEN uc.`billMode` = 'PER_PERSON' THEN 'PER_PERSON'
    WHEN uc.`unitRate` IS NOT NULL OR uc.`billMode` = 'METERED' THEN 'METERED'
    ELSE 'FIXED' END,
  CASE WHEN uc.`unitRate` IS NOT NULL OR uc.`billMode` IN ('METERED','PER_PERSON') THEN COALESCE(uc.`unitRate`, uc.`fixedRate`) ELSE uc.`fixedRate` END,
  CASE uc.`utilityType` WHEN 'ELECTRICITY' THEN 'kWh' WHEN 'WATER' THEN 'm³' WHEN 'GAS' THEN 'm³' ELSE NULL END,
  CASE WHEN uc.`slabConfig` IS NOT NULL THEN JSON_OBJECT('steps', uc.`slabConfig`) ELSE NULL END,
  CASE WHEN uc.`unitRate` IS NOT NULL AND uc.`fixedRate` IS NOT NULL THEN uc.`fixedRate` ELSE NULL END,
  uc.`utilityType` NOT IN ('GARAGE', 'INTERNET'),
  uc.`isActive`,
  0,
  CURRENT_TIMESTAMP(3)
FROM `utility_configs` uc;

-- meter readings for utilities that had no config: create a METERED bill type
INSERT IGNORE INTO `bill_types` (`ownerId`, `name`, `calcMethod`, `rate`, `unitLabel`, `appliesToAll`, `isActive`, `updatedAt`)
SELECT mr.`ownerId`, CASE mr.`utilityType`
  WHEN 'ELECTRICITY' THEN 'Electricity' WHEN 'WATER' THEN 'Water' WHEN 'GAS' THEN 'Gas'
  WHEN 'SERVICE_CHARGE' THEN 'Service Charge' WHEN 'GARAGE' THEN 'Garage' WHEN 'LIFT' THEN 'Lift'
  WHEN 'GENERATOR' THEN 'Generator' WHEN 'SECURITY' THEN 'Security' WHEN 'CLEANING' THEN 'Cleaning'
  WHEN 'INTERNET' THEN 'Internet' END, 'METERED', MAX(mr.`unitRate`),
  CASE mr.`utilityType` WHEN 'ELECTRICITY' THEN 'kWh' ELSE 'm³' END, true, true, CURRENT_TIMESTAMP(3)
FROM `meter_readings` mr
GROUP BY mr.`ownerId`, mr.`utilityType`;

-- ===== meter_readings -> bill_entries (one per flat/type/month, latest reading wins) =====
INSERT INTO `bill_entries` (`flatId`, `billTypeId`, `month`, `year`, `previousReading`, `currentReading`, `units`, `note`, `updatedAt`)
SELECT mr.`flatId`, bt.`id`, MONTH(mr.`readingDate`), YEAR(mr.`readingDate`),
  mr.`previousReading`, mr.`currentReading`, mr.`consumption`, mr.`notes`, CURRENT_TIMESTAMP(3)
FROM `meter_readings` mr
JOIN `bill_types` bt ON bt.`ownerId` = mr.`ownerId` AND bt.`name` = CASE mr.`utilityType`
  WHEN 'ELECTRICITY' THEN 'Electricity' WHEN 'WATER' THEN 'Water' WHEN 'GAS' THEN 'Gas'
  WHEN 'SERVICE_CHARGE' THEN 'Service Charge' WHEN 'GARAGE' THEN 'Garage' WHEN 'LIFT' THEN 'Lift'
  WHEN 'GENERATOR' THEN 'Generator' WHEN 'SECURITY' THEN 'Security' WHEN 'CLEANING' THEN 'Cleaning'
  WHEN 'INTERNET' THEN 'Internet' END
ORDER BY mr.`readingDate`
ON DUPLICATE KEY UPDATE `previousReading` = VALUES(`previousReading`), `currentReading` = VALUES(`currentReading`),
  `units` = VALUES(`units`), `note` = VALUES(`note`);

-- ===== invoice columns -> invoice_items =====
INSERT INTO `invoice_items` (`invoiceId`, `billTypeId`, `label`, `amount`, `sortOrder`)
SELECT i.`id`, NULL, 'Rent', i.`rent`, 0 FROM `invoices` i WHERE i.`rent` <> 0;

INSERT INTO `invoice_items` (`invoiceId`, `billTypeId`, `label`, `amount`, `sortOrder`)
SELECT i.`id`, bt.`id`, 'Electricity', i.`electricity`, 1 FROM `invoices` i
LEFT JOIN `bill_types` bt ON bt.`ownerId` = i.`ownerId` AND bt.`name` = 'Electricity'
WHERE i.`electricity` <> 0;

INSERT INTO `invoice_items` (`invoiceId`, `billTypeId`, `label`, `amount`, `sortOrder`)
SELECT i.`id`, bt.`id`, 'Water', i.`water`, 2 FROM `invoices` i
LEFT JOIN `bill_types` bt ON bt.`ownerId` = i.`ownerId` AND bt.`name` = 'Water'
WHERE i.`water` <> 0;

INSERT INTO `invoice_items` (`invoiceId`, `billTypeId`, `label`, `amount`, `sortOrder`)
SELECT i.`id`, bt.`id`, 'Gas', i.`gas`, 3 FROM `invoices` i
LEFT JOIN `bill_types` bt ON bt.`ownerId` = i.`ownerId` AND bt.`name` = 'Gas'
WHERE i.`gas` <> 0;

INSERT INTO `invoice_items` (`invoiceId`, `billTypeId`, `label`, `amount`, `sortOrder`)
SELECT i.`id`, bt.`id`, 'Service Charge', i.`serviceCharge`, 4 FROM `invoices` i
LEFT JOIN `bill_types` bt ON bt.`ownerId` = i.`ownerId` AND bt.`name` = 'Service Charge'
WHERE i.`serviceCharge` <> 0;

INSERT INTO `invoice_items` (`invoiceId`, `billTypeId`, `label`, `amount`, `sortOrder`)
SELECT i.`id`, bt.`id`, 'Internet', i.`internet`, 5 FROM `invoices` i
LEFT JOIN `bill_types` bt ON bt.`ownerId` = i.`ownerId` AND bt.`name` = 'Internet'
WHERE i.`internet` <> 0;

INSERT INTO `invoice_items` (`invoiceId`, `billTypeId`, `label`, `amount`, `sortOrder`)
SELECT i.`id`, bt.`id`, 'Garage', i.`garage`, 6 FROM `invoices` i
LEFT JOIN `bill_types` bt ON bt.`ownerId` = i.`ownerId` AND bt.`name` = 'Garage'
WHERE i.`garage` <> 0;

-- ===== drop old columns/tables (data copied above) =====
ALTER TABLE `invoices` DROP COLUMN `electricity`,
    DROP COLUMN `garage`,
    DROP COLUMN `gas`,
    DROP COLUMN `internet`,
    DROP COLUMN `serviceCharge`,
    DROP COLUMN `water`;

DROP TABLE `meter_readings`;

DROP TABLE `utility_configs`;
