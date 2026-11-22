-- AlterTable
ALTER TABLE `notifications` ADD COLUMN `segments` INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `organizations` ADD COLUMN `paidUntil` DATETIME(3) NULL,
    ADD COLUMN `smsCredits` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `suspendedAt` DATETIME(3) NULL;

-- CreateTable
CREATE TABLE `sms_credit_entries` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `orgId` BIGINT NOT NULL,
    `delta` INTEGER NOT NULL,
    `reason` VARCHAR(255) NOT NULL,
    `byUserId` BIGINT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `sms_credit_entries_orgId_createdAt_idx`(`orgId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `sms_credit_entries` ADD CONSTRAINT `sms_credit_entries_orgId_fkey` FOREIGN KEY (`orgId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;


-- Data: workspaces that exist before plans are enforced keep working: PRO for a year and a starting SMS balance.
UPDATE `organizations` SET `plan` = 'PRO', `paidUntil` = DATE_ADD(CURRENT_DATE, INTERVAL 1 YEAR), `smsCredits` = 500;
