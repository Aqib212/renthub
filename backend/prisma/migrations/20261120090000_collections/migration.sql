-- AlterTable
ALTER TABLE `payments` ADD COLUMN `collectedById` BIGINT NULL,
    ADD COLUMN `handoverId` BIGINT NULL,
    ADD COLUMN `receiptNo` VARCHAR(30) NULL,
    ADD COLUMN `shareToken` VARCHAR(64) NULL;

-- AlterTable
ALTER TABLE `tenants` ADD COLUMN `lang` ENUM('BN', 'EN') NOT NULL DEFAULT 'BN';

-- CreateTable
CREATE TABLE `org_counters` (
    `orgId` BIGINT NOT NULL,
    `key` VARCHAR(40) NOT NULL,
    `value` INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (`orgId`, `key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notifications` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `orgId` BIGINT NOT NULL,
    `channel` ENUM('SMS', 'EMAIL') NOT NULL DEFAULT 'SMS',
    `to` VARCHAR(20) NULL,
    `template` VARCHAR(30) NOT NULL,
    `lang` ENUM('BN', 'EN') NOT NULL DEFAULT 'BN',
    `payload` JSON NOT NULL,
    `body` TEXT NULL,
    `status` ENUM('QUEUED', 'SENT', 'FAILED', 'SKIPPED') NOT NULL DEFAULT 'QUEUED',
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `lastError` TEXT NULL,
    `sendAfter` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `sentAt` DATETIME(3) NULL,
    `dedupeKey` VARCHAR(120) NULL,
    `invoiceId` BIGINT NULL,
    `paymentId` BIGINT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `notifications_dedupeKey_key`(`dedupeKey`),
    INDEX `notifications_status_sendAfter_idx`(`status`, `sendAfter`),
    INDEX `notifications_orgId_createdAt_idx`(`orgId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cash_handovers` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `orgId` BIGINT NOT NULL,
    `fromMembershipId` BIGINT NOT NULL,
    `toMembershipId` BIGINT NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `date` DATE NOT NULL,
    `note` VARCHAR(255) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `cash_handovers_orgId_date_idx`(`orgId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `payments_shareToken_key` ON `payments`(`shareToken`);

-- CreateIndex
CREATE INDEX `payments_collectedById_handoverId_idx` ON `payments`(`collectedById`, `handoverId`);

-- CreateIndex
CREATE UNIQUE INDEX `payments_orgId_receiptNo_key` ON `payments`(`orgId`, `receiptNo`);

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_collectedById_fkey` FOREIGN KEY (`collectedById`) REFERENCES `memberships`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_handoverId_fkey` FOREIGN KEY (`handoverId`) REFERENCES `cash_handovers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `org_counters` ADD CONSTRAINT `org_counters_orgId_fkey` FOREIGN KEY (`orgId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_orgId_fkey` FOREIGN KEY (`orgId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `invoices`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_paymentId_fkey` FOREIGN KEY (`paymentId`) REFERENCES `payments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cash_handovers` ADD CONSTRAINT `cash_handovers_orgId_fkey` FOREIGN KEY (`orgId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cash_handovers` ADD CONSTRAINT `cash_handovers_fromMembershipId_fkey` FOREIGN KEY (`fromMembershipId`) REFERENCES `memberships`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cash_handovers` ADD CONSTRAINT `cash_handovers_toMembershipId_fkey` FOREIGN KEY (`toMembershipId`) REFERENCES `memberships`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;


-- ===== Backfill: number existing receipts in date order, per organisation per year (deposit adjustments get none) =====
UPDATE `payments` p
JOIN (
  SELECT `id`, YEAR(`date`) AS `y`, ROW_NUMBER() OVER (PARTITION BY `orgId`, YEAR(`date`) ORDER BY `date`, `id`) AS `rn`
  FROM `payments` WHERE `method` <> 'DEPOSIT'
) x ON x.`id` = p.`id`
SET p.`receiptNo` = CONCAT('RCP-', x.`y`, '-', LPAD(x.`rn`, 6, '0'));

-- counters continue from the last number used
INSERT INTO `org_counters` (`orgId`, `key`, `value`)
SELECT `orgId`, CONCAT('receipt:', YEAR(`date`)), COUNT(*) FROM `payments` WHERE `method` <> 'DEPOSIT' GROUP BY `orgId`, YEAR(`date`);
