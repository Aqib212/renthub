-- DropForeignKey
ALTER TABLE `audit_logs` DROP FOREIGN KEY `audit_logs_userId_fkey`;

-- AlterTable
ALTER TABLE `audit_logs` ADD COLUMN `tenantId` BIGINT NULL,
    MODIFY `userId` BIGINT NULL;

-- AlterTable
ALTER TABLE `tenants` ADD COLUMN `phoneNormalized` VARCHAR(13) NULL;

-- CreateTable
CREATE TABLE `portal_otps` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `phone` VARCHAR(13) NOT NULL,
    `codeHash` VARCHAR(100) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `portal_otps_phone_createdAt_idx`(`phone`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `portal_sessions` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `phone` VARCHAR(13) NOT NULL,
    `refreshHash` VARCHAR(64) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `userAgent` VARCHAR(255) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastSeenAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `portal_sessions_refreshHash_key`(`refreshHash`),
    INDEX `portal_sessions_phone_idx`(`phone`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payment_claims` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `orgId` BIGINT NOT NULL,
    `invoiceId` BIGINT NOT NULL,
    `tenantId` BIGINT NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `method` ENUM('CASH', 'BKASH', 'NAGAD', 'ROCKET', 'BANK', 'CHEQUE', 'DEPOSIT', 'TDS') NOT NULL,
    `transactionId` VARCHAR(100) NOT NULL,
    `paidOn` DATE NOT NULL,
    `note` VARCHAR(255) NULL,
    `status` ENUM('PENDING', 'CONFIRMED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `paymentId` BIGINT NULL,
    `reviewedById` BIGINT NULL,
    `reviewNote` VARCHAR(255) NULL,
    `reviewedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `payment_claims_paymentId_key`(`paymentId`),
    INDEX `payment_claims_orgId_status_idx`(`orgId`, `status`),
    INDEX `payment_claims_tenantId_idx`(`tenantId`),
    UNIQUE INDEX `payment_claims_orgId_method_transactionId_key`(`orgId`, `method`, `transactionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notice_requests` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `orgId` BIGINT NOT NULL,
    `agreementId` BIGINT NOT NULL,
    `tenantId` BIGINT NOT NULL,
    `noticeDate` DATE NOT NULL,
    `moveOutDate` DATE NOT NULL,
    `reason` VARCHAR(500) NULL,
    `status` ENUM('PENDING', 'ACCEPTED', 'DECLINED', 'WITHDRAWN') NOT NULL DEFAULT 'PENDING',
    `reviewedById` BIGINT NULL,
    `reviewNote` VARCHAR(255) NULL,
    `reviewedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `notice_requests_orgId_status_idx`(`orgId`, `status`),
    INDEX `notice_requests_agreementId_status_idx`(`agreementId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `tenants_phoneNormalized_idx` ON `tenants`(`phoneNormalized`);

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_claims` ADD CONSTRAINT `payment_claims_orgId_fkey` FOREIGN KEY (`orgId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_claims` ADD CONSTRAINT `payment_claims_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `invoices`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_claims` ADD CONSTRAINT `payment_claims_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_claims` ADD CONSTRAINT `payment_claims_paymentId_fkey` FOREIGN KEY (`paymentId`) REFERENCES `payments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_claims` ADD CONSTRAINT `payment_claims_reviewedById_fkey` FOREIGN KEY (`reviewedById`) REFERENCES `memberships`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notice_requests` ADD CONSTRAINT `notice_requests_orgId_fkey` FOREIGN KEY (`orgId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notice_requests` ADD CONSTRAINT `notice_requests_agreementId_fkey` FOREIGN KEY (`agreementId`) REFERENCES `agreements`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notice_requests` ADD CONSTRAINT `notice_requests_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notice_requests` ADD CONSTRAINT `notice_requests_reviewedById_fkey` FOREIGN KEY (`reviewedById`) REFERENCES `memberships`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;


-- Backfill: same rules as normalizeBdPhone (shared/notify/phone.ts): strip spaces, dashes, brackets, dots
-- and a leading +; 880... -> 0...; keep only 01[3-9]XXXXXXXX, stored as 8801XXXXXXXXX.
UPDATE `tenants`
SET `phoneNormalized` = (
  SELECT CASE WHEN l REGEXP '^01[3-9][0-9]{8}$' THEN CONCAT('88', l) ELSE NULL END
  FROM (
    SELECT CASE WHEN d LIKE '880%' THEN CONCAT('0', SUBSTRING(d, 4)) ELSE d END AS l
    FROM (
      SELECT TRIM(LEADING '+' FROM REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(`phone`, ' ', ''), '-', ''), '(', ''), ')', ''), '.', '')) AS d
    ) AS stripped
  ) AS local
)
WHERE `phone` IS NOT NULL;
