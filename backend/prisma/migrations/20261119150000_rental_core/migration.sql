-- Phase 2: generic rental core. Asset -> Agreement -> Invoice, with a deposit ledger.
-- Order matters: build assets and agreements from the current tenant/flat data BEFORE dropping those columns.

-- ===== 1. New tables =====
CREATE TABLE `assets` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `orgId` BIGINT NOT NULL,
    `kind` ENUM('UNIT', 'VEHICLE') NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `legacyFlatId` BIGINT NULL, -- temporary
    INDEX `assets_orgId_kind_idx`(`orgId`, `kind`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `agreements` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `orgId` BIGINT NOT NULL,
    `assetId` BIGINT NOT NULL,
    `tenantId` BIGINT NOT NULL,
    `cycle` ENUM('MONTHLY', 'DAILY', 'WEEKLY', 'TRIP') NOT NULL DEFAULT 'MONTHLY',
    `rate` DECIMAL(12, 2) NOT NULL,
    `startDate` DATE NOT NULL,
    `endDate` DATE NULL,
    `dueDay` INTEGER NOT NULL DEFAULT 10,
    `noticeDays` INTEGER NOT NULL DEFAULT 60,
    `noticeDate` DATE NULL,
    `tdsPercent` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `bankOnly` BOOLEAN NOT NULL DEFAULT false,
    `status` ENUM('DRAFT', 'ACTIVE', 'NOTICE', 'ENDED') NOT NULL DEFAULT 'DRAFT',
    `documentPath` TEXT NULL,
    `terms` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    INDEX `agreements_orgId_status_idx`(`orgId`, `status`),
    INDEX `agreements_assetId_status_idx`(`assetId`, `status`),
    INDEX `agreements_tenantId_idx`(`tenantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `rate_revisions` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `agreementId` BIGINT NOT NULL,
    `effectiveFrom` DATE NOT NULL,
    `rate` DECIMAL(12, 2) NOT NULL,
    `reason` VARCHAR(255) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX `rate_revisions_agreementId_effectiveFrom_idx`(`agreementId`, `effectiveFrom`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `deposit_entries` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `agreementId` BIGINT NOT NULL,
    `type` ENUM('RECEIVED', 'ADJUSTED', 'DEDUCTED_DAMAGE', 'REFUNDED') NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `date` DATE NOT NULL,
    `note` VARCHAR(255) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX `deposit_entries_agreementId_idx`(`agreementId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ===== 2. Flats become the UNIT detail of an asset =====
ALTER TABLE `flats` ADD COLUMN `assetId` BIGINT NULL,
    ADD COLUMN `electricityMode` ENUM('SUBMETER', 'PREPAID', 'SHARED') NOT NULL DEFAULT 'SUBMETER',
    ADD COLUMN `parentId` BIGINT NULL,
    ADD COLUMN `toLet` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `unitType` ENUM('FLAT', 'ROOM', 'SEAT', 'SHOP', 'GARAGE') NOT NULL DEFAULT 'FLAT',
    MODIFY `status` ENUM('VACANT', 'OCCUPIED', 'NOTICE', 'UNDER_MAINTENANCE') NOT NULL DEFAULT 'VACANT';

INSERT INTO `assets` (`orgId`, `kind`, `createdAt`, `legacyFlatId`)
SELECT b.`orgId`, 'UNIT', f.`createdAt`, f.`id`
FROM `flats` f JOIN `floors` fl ON fl.`id` = f.`floorId` JOIN `buildings` b ON b.`id` = fl.`buildingId`;

UPDATE `flats` f JOIN `assets` a ON a.`legacyFlatId` = f.`id` SET f.`assetId` = a.`id`;
ALTER TABLE `flats` MODIFY `assetId` BIGINT NOT NULL;
CREATE UNIQUE INDEX `flats_assetId_key` ON `flats`(`assetId`);

-- ===== 3. One agreement per tenant record, from today's flat rent and tenant dates =====
INSERT INTO `agreements` (`orgId`, `assetId`, `tenantId`, `rate`, `startDate`, `endDate`, `dueDay`, `noticeDays`, `bankOnly`, `status`, `documentPath`, `updatedAt`)
SELECT t.`orgId`, f.`assetId`, t.`id`, f.`rent`,
       DATE(COALESCE(t.`moveInDate`, t.`createdAt`)),
       DATE(t.`moveOutDate`),
       COALESCE(CAST(JSON_EXTRACT(o.`settings`, '$.dueDay') AS UNSIGNED), 10),
       COALESCE(CAST(JSON_EXTRACT(o.`settings`, '$.noticeMonths') AS UNSIGNED), 2) * 30,
       f.`rent` > 25000,
       IF(t.`status` = 'ACTIVE', 'ACTIVE', 'ENDED'),
       t.`agreementDoc`,
       CURRENT_TIMESTAMP(3)
FROM `tenants` t
JOIN `flats` f ON f.`id` = t.`flatId`
JOIN `organizations` o ON o.`id` = t.`orgId`;

-- deposits actually held: the flat's advance and security deposit, for current tenants only
INSERT INTO `deposit_entries` (`agreementId`, `type`, `amount`, `date`, `note`)
SELECT a.`id`, 'RECEIVED', f.`advance`, a.`startDate`, 'Advance (copied from the flat record)'
FROM `agreements` a JOIN `flats` f ON f.`assetId` = a.`assetId`
WHERE a.`status` = 'ACTIVE' AND f.`advance` > 0;

INSERT INTO `deposit_entries` (`agreementId`, `type`, `amount`, `date`, `note`)
SELECT a.`id`, 'RECEIVED', f.`securityDeposit`, a.`startDate`, 'Security deposit (copied from the flat record)'
FROM `agreements` a JOIN `flats` f ON f.`assetId` = a.`assetId`
WHERE a.`status` = 'ACTIVE' AND f.`securityDeposit` > 0;

-- ===== 4. Invoices: link to agreement + asset, with the billing period =====
ALTER TABLE `invoices` ADD COLUMN `agreementId` BIGINT NULL,
    ADD COLUMN `assetId` BIGINT NULL,
    ADD COLUMN `periodEnd` DATE NULL,
    ADD COLUMN `periodStart` DATE NULL;

UPDATE `invoices` i JOIN `flats` f ON f.`id` = i.`flatId`
SET i.`assetId` = f.`assetId`,
    i.`periodStart` = STR_TO_DATE(CONCAT(i.`year`, '-', i.`month`, '-01'), '%Y-%c-%d'),
    i.`periodEnd` = LAST_DAY(STR_TO_DATE(CONCAT(i.`year`, '-', i.`month`, '-01'), '%Y-%c-%d'));

UPDATE `invoices` i JOIN `agreements` a ON a.`tenantId` = i.`tenantId`
SET i.`agreementId` = a.`id`;

-- the flatId foreign key needs an index before the old unique key can go
CREATE INDEX `invoices_flatId_month_year_idx` ON `invoices`(`flatId`, `month`, `year`);
DROP INDEX `invoices_flatId_month_year_key` ON `invoices`;
CREATE UNIQUE INDEX `invoices_agreementId_periodStart_key` ON `invoices`(`agreementId`, `periodStart`);

-- ===== 5. Tenants become parties: flat/dates/status now live on the agreement =====
ALTER TABLE `tenants` DROP FOREIGN KEY `tenants_flatId_fkey`;
DROP INDEX `tenants_status_idx` ON `tenants`;
ALTER TABLE `tenants` DROP COLUMN `agreementDoc`,
    DROP COLUMN `flatId`,
    DROP COLUMN `moveInDate`,
    DROP COLUMN `moveOutDate`,
    DROP COLUMN `status`,
    ADD COLUMN `household` JSON NULL,
    ADD COLUMN `kind` ENUM('PERSON', 'COMPANY') NOT NULL DEFAULT 'PERSON';

ALTER TABLE `assets` DROP COLUMN `legacyFlatId`;

-- ===== 6. Deposit can settle dues at move-out =====
ALTER TABLE `payments` MODIFY `method` ENUM('CASH', 'BKASH', 'NAGAD', 'ROCKET', 'BANK', 'CHEQUE', 'DEPOSIT') NOT NULL;

-- ===== 7. Foreign keys =====
ALTER TABLE `flats` ADD CONSTRAINT `flats_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `assets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `flats` ADD CONSTRAINT `flats_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `flats`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_agreementId_fkey` FOREIGN KEY (`agreementId`) REFERENCES `agreements`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `assets`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `assets` ADD CONSTRAINT `assets_orgId_fkey` FOREIGN KEY (`orgId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `agreements` ADD CONSTRAINT `agreements_orgId_fkey` FOREIGN KEY (`orgId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `agreements` ADD CONSTRAINT `agreements_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `assets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `agreements` ADD CONSTRAINT `agreements_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `rate_revisions` ADD CONSTRAINT `rate_revisions_agreementId_fkey` FOREIGN KEY (`agreementId`) REFERENCES `agreements`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `deposit_entries` ADD CONSTRAINT `deposit_entries_agreementId_fkey` FOREIGN KEY (`agreementId`) REFERENCES `agreements`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
