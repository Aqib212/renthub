-- Phase 1: workspaces. Every owner becomes an Organization; business rows move from ownerId to orgId.
-- Hand-ordered so no data is lost: create orgs -> backfill orgId -> only then drop ownerId.

-- ===== 1. New tables =====
CREATE TABLE `organizations` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(200) NOT NULL,
    `plan` VARCHAR(30) NOT NULL DEFAULT 'FREE',
    `unitLimit` INTEGER NULL,
    `settings` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `legacyOwnerId` BIGINT NULL, -- temporary, dropped at the end
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `memberships` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `userId` BIGINT NOT NULL,
    `orgId` BIGINT NOT NULL,
    `role` ENUM('OWNER', 'MANAGER', 'CARETAKER', 'ACCOUNTANT') NOT NULL,
    `buildingIds` JSON NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    INDEX `memberships_orgId_idx`(`orgId`),
    UNIQUE INDEX `memberships_userId_orgId_key`(`userId`, `orgId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `memberships` ADD CONSTRAINT `memberships_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `memberships` ADD CONSTRAINT `memberships_orgId_fkey` FOREIGN KEY (`orgId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- ===== 2. One organisation per owner (house owners, plus anyone who owns rows) =====
INSERT INTO `organizations` (`name`, `settings`, `updatedAt`, `legacyOwnerId`)
SELECT CONCAT(u.`firstName`, ' ', u.`lastName`), JSON_OBJECT('dueDay', 10, 'noticeMonths', 2), CURRENT_TIMESTAMP(3), u.`id`
FROM `users` u
WHERE u.`role` = 'HOUSE_OWNER'
   OR EXISTS (SELECT 1 FROM `buildings` b WHERE b.`ownerId` = u.`id`)
   OR EXISTS (SELECT 1 FROM `tenants` t WHERE t.`ownerId` = u.`id`)
   OR EXISTS (SELECT 1 FROM `bill_types` x WHERE x.`ownerId` = u.`id`)
   OR EXISTS (SELECT 1 FROM `invoices` i WHERE i.`ownerId` = u.`id`)
   OR EXISTS (SELECT 1 FROM `payments` p WHERE p.`ownerId` = u.`id`)
   OR EXISTS (SELECT 1 FROM `expenses` e WHERE e.`ownerId` = u.`id`);

INSERT INTO `memberships` (`userId`, `orgId`, `role`, `updatedAt`)
SELECT o.`legacyOwnerId`, o.`id`, 'OWNER', CURRENT_TIMESTAMP(3) FROM `organizations` o;

-- ===== 3. Drop old foreign keys and indexes on ownerId =====
ALTER TABLE `bill_types` DROP FOREIGN KEY `bill_types_ownerId_fkey`;
ALTER TABLE `buildings` DROP FOREIGN KEY `buildings_ownerId_fkey`;
ALTER TABLE `expenses` DROP FOREIGN KEY `expenses_ownerId_fkey`;
ALTER TABLE `invoices` DROP FOREIGN KEY `invoices_ownerId_fkey`;
ALTER TABLE `payments` DROP FOREIGN KEY `payments_ownerId_fkey`;
ALTER TABLE `tenants` DROP FOREIGN KEY `tenants_ownerId_fkey`;

DROP INDEX `bill_types_ownerId_name_key` ON `bill_types`;
DROP INDEX `expenses_ownerId_category_idx` ON `expenses`;
DROP INDEX `expenses_ownerId_date_idx` ON `expenses`;
DROP INDEX `invoices_ownerId_month_year_idx` ON `invoices`;
DROP INDEX `invoices_ownerId_status_idx` ON `invoices`;
DROP INDEX `payments_ownerId_date_idx` ON `payments`;

-- ===== 4. Add orgId, backfill from ownerId, then make it required and drop ownerId =====
ALTER TABLE `bill_types` ADD COLUMN `orgId` BIGINT NULL;
ALTER TABLE `buildings`  ADD COLUMN `orgId` BIGINT NULL;
ALTER TABLE `expenses`   ADD COLUMN `orgId` BIGINT NULL;
ALTER TABLE `invoices`   ADD COLUMN `orgId` BIGINT NULL;
ALTER TABLE `payments`   ADD COLUMN `orgId` BIGINT NULL;
ALTER TABLE `tenants`    ADD COLUMN `orgId` BIGINT NULL;

UPDATE `bill_types` t JOIN `organizations` o ON o.`legacyOwnerId` = t.`ownerId` SET t.`orgId` = o.`id`;
UPDATE `buildings`  t JOIN `organizations` o ON o.`legacyOwnerId` = t.`ownerId` SET t.`orgId` = o.`id`;
UPDATE `expenses`   t JOIN `organizations` o ON o.`legacyOwnerId` = t.`ownerId` SET t.`orgId` = o.`id`;
UPDATE `invoices`   t JOIN `organizations` o ON o.`legacyOwnerId` = t.`ownerId` SET t.`orgId` = o.`id`;
UPDATE `payments`   t JOIN `organizations` o ON o.`legacyOwnerId` = t.`ownerId` SET t.`orgId` = o.`id`;
UPDATE `tenants`    t JOIN `organizations` o ON o.`legacyOwnerId` = t.`ownerId` SET t.`orgId` = o.`id`;

-- fails loudly (NOT NULL) if any row could not be mapped, instead of silently losing its owner
ALTER TABLE `bill_types` MODIFY `orgId` BIGINT NOT NULL, DROP COLUMN `ownerId`;
ALTER TABLE `buildings`  MODIFY `orgId` BIGINT NOT NULL, DROP COLUMN `ownerId`;
ALTER TABLE `expenses`   MODIFY `orgId` BIGINT NOT NULL, DROP COLUMN `ownerId`;
ALTER TABLE `invoices`   MODIFY `orgId` BIGINT NOT NULL, DROP COLUMN `ownerId`;
ALTER TABLE `payments`   MODIFY `orgId` BIGINT NOT NULL, DROP COLUMN `ownerId`;
ALTER TABLE `tenants`    MODIFY `orgId` BIGINT NOT NULL, DROP COLUMN `ownerId`;

CREATE UNIQUE INDEX `bill_types_orgId_name_key` ON `bill_types`(`orgId`, `name`);
CREATE INDEX `buildings_orgId_idx` ON `buildings`(`orgId`);
CREATE INDEX `expenses_orgId_date_idx` ON `expenses`(`orgId`, `date`);
CREATE INDEX `expenses_orgId_category_idx` ON `expenses`(`orgId`, `category`);
CREATE INDEX `invoices_orgId_month_year_idx` ON `invoices`(`orgId`, `month`, `year`);
CREATE INDEX `invoices_orgId_status_idx` ON `invoices`(`orgId`, `status`);
CREATE INDEX `payments_orgId_date_idx` ON `payments`(`orgId`, `date`);
CREATE INDEX `tenants_orgId_idx` ON `tenants`(`orgId`);

ALTER TABLE `buildings`  ADD CONSTRAINT `buildings_orgId_fkey`  FOREIGN KEY (`orgId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `tenants`    ADD CONSTRAINT `tenants_orgId_fkey`    FOREIGN KEY (`orgId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `bill_types` ADD CONSTRAINT `bill_types_orgId_fkey` FOREIGN KEY (`orgId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `invoices`   ADD CONSTRAINT `invoices_orgId_fkey`   FOREIGN KEY (`orgId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `payments`   ADD CONSTRAINT `payments_orgId_fkey`   FOREIGN KEY (`orgId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `expenses`   ADD CONSTRAINT `expenses_orgId_fkey`   FOREIGN KEY (`orgId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- ===== 5. Platform role only on users; business roles now live on memberships =====
ALTER TABLE `users` MODIFY `role` ENUM('SUPER_ADMIN', 'HOUSE_OWNER', 'MANAGER', 'ACCOUNTANT', 'USER') NOT NULL DEFAULT 'USER';
UPDATE `users` SET `role` = 'USER' WHERE `role` <> 'SUPER_ADMIN';
ALTER TABLE `users` MODIFY `role` ENUM('SUPER_ADMIN', 'USER') NOT NULL DEFAULT 'USER';

ALTER TABLE `organizations` DROP COLUMN `legacyOwnerId`;
