/*
  Warnings:

  - Added the required column `amount` to the `expenses` table without a default value. This is not possible if the table is not empty.
  - Added the required column `category` to the `expenses` table without a default value. This is not possible if the table is not empty.
  - Added the required column `rent` to the `flats` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `buildings` ADD COLUMN `address` TEXT NULL,
    ADD COLUMN `area` VARCHAR(100) NULL,
    ADD COLUMN `description` TEXT NULL,
    ADD COLUMN `district` VARCHAR(100) NULL,
    ADD COLUMN `holdingNumber` VARCHAR(100) NULL,
    ADD COLUMN `ward` VARCHAR(50) NULL;

-- AlterTable
ALTER TABLE `expenses` ADD COLUMN `amount` DECIMAL(12, 2) NOT NULL,
    ADD COLUMN `buildingId` VARCHAR(191) NULL,
    ADD COLUMN `category` ENUM('LIFT', 'SECURITY', 'CLEANING', 'COMMON_ELECTRICITY', 'REPAIRS', 'MAINTENANCE', 'MISC') NOT NULL,
    ADD COLUMN `date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `description` TEXT NULL;

-- AlterTable
ALTER TABLE `flats` ADD COLUMN `advance` DECIMAL(12, 2) NULL,
    ADD COLUMN `area` DECIMAL(10, 2) NULL,
    ADD COLUMN `balconies` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `bathrooms` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `bedrooms` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `flatNumber` VARCHAR(50) NULL,
    ADD COLUMN `kitchens` INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN `rent` DECIMAL(12, 2) NOT NULL,
    ADD COLUMN `securityDeposit` DECIMAL(12, 2) NULL,
    ADD COLUMN `status` ENUM('VACANT', 'OCCUPIED', 'UNDER_MAINTENANCE') NOT NULL DEFAULT 'VACANT';

-- AlterTable
ALTER TABLE `floors` ADD COLUMN `description` TEXT NULL;

-- CreateTable
CREATE TABLE `tenants` (
    `id` VARCHAR(191) NOT NULL,
    `flatId` VARCHAR(191) NOT NULL,
    `ownerId` VARCHAR(191) NOT NULL,
    `firstName` VARCHAR(100) NOT NULL,
    `lastName` VARCHAR(100) NOT NULL,
    `phone` VARCHAR(20) NULL,
    `email` VARCHAR(255) NULL,
    `nid` VARCHAR(50) NULL,
    `passport` VARCHAR(50) NULL,
    `drivingLicense` VARCHAR(50) NULL,
    `occupation` VARCHAR(100) NULL,
    `office` VARCHAR(255) NULL,
    `emergencyContact` VARCHAR(20) NULL,
    `presentAddress` TEXT NULL,
    `permanentAddress` TEXT NULL,
    `photo` TEXT NULL,
    `agreementDoc` TEXT NULL,
    `moveInDate` DATETIME(3) NULL,
    `moveOutDate` DATETIME(3) NULL,
    `status` ENUM('ACTIVE', 'FORMER') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `tenants_flatId_idx`(`flatId`),
    INDEX `tenants_ownerId_idx`(`ownerId`),
    INDEX `tenants_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `meter_readings` (
    `id` VARCHAR(191) NOT NULL,
    `flatId` VARCHAR(191) NOT NULL,
    `ownerId` VARCHAR(191) NOT NULL,
    `utilityType` ENUM('ELECTRICITY', 'WATER', 'GAS', 'SERVICE_CHARGE', 'GARAGE', 'LIFT', 'GENERATOR', 'SECURITY', 'CLEANING', 'INTERNET') NOT NULL,
    `readingDate` DATETIME(3) NOT NULL,
    `currentReading` DECIMAL(12, 2) NULL,
    `previousReading` DECIMAL(12, 2) NULL,
    `consumption` DECIMAL(12, 2) NULL,
    `unitRate` DECIMAL(10, 2) NULL,
    `fixedCharge` DECIMAL(10, 2) NULL,
    `vat` DECIMAL(10, 2) NULL,
    `fuelAdjustment` DECIMAL(10, 2) NULL,
    `demandCharge` DECIMAL(10, 2) NULL,
    `meterRent` DECIMAL(10, 2) NULL,
    `totalAmount` DECIMAL(12, 2) NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `meter_readings_flatId_utilityType_readingDate_idx`(`flatId`, `utilityType`, `readingDate`),
    INDEX `meter_readings_ownerId_idx`(`ownerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `utility_configs` (
    `id` VARCHAR(191) NOT NULL,
    `ownerId` VARCHAR(191) NOT NULL,
    `utilityType` ENUM('ELECTRICITY', 'WATER', 'GAS', 'SERVICE_CHARGE', 'GARAGE', 'LIFT', 'GENERATOR', 'SECURITY', 'CLEANING', 'INTERNET') NOT NULL,
    `billMode` VARCHAR(20) NULL,
    `fixedRate` DECIMAL(10, 2) NULL,
    `unitRate` DECIMAL(10, 2) NULL,
    `slabConfig` JSON NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `utility_configs_ownerId_utilityType_key`(`ownerId`, `utilityType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `invoices` (
    `id` VARCHAR(191) NOT NULL,
    `flatId` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NULL,
    `ownerId` VARCHAR(191) NOT NULL,
    `month` INTEGER NOT NULL,
    `year` INTEGER NOT NULL,
    `rent` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `electricity` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `water` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `gas` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `serviceCharge` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `internet` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `garage` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `previousDue` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `discount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `fine` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `totalAmount` DECIMAL(12, 2) NOT NULL,
    `paidAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `dueAmount` DECIMAL(12, 2) NOT NULL,
    `status` ENUM('PENDING', 'PAID', 'PARTIALLY_PAID', 'OVERDUE') NOT NULL DEFAULT 'PENDING',
    `dueDate` DATETIME(3) NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `invoices_flatId_month_year_idx`(`flatId`, `month`, `year`),
    INDEX `invoices_ownerId_month_year_idx`(`ownerId`, `month`, `year`),
    INDEX `invoices_ownerId_status_idx`(`ownerId`, `status`),
    INDEX `invoices_tenantId_idx`(`tenantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payments` (
    `id` VARCHAR(191) NOT NULL,
    `invoiceId` VARCHAR(191) NOT NULL,
    `ownerId` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `method` ENUM('CASH', 'BKASH', 'NAGAD', 'ROCKET', 'BANK', 'CHEQUE') NOT NULL,
    `transactionId` VARCHAR(100) NULL,
    `collector` VARCHAR(100) NULL,
    `remarks` TEXT NULL,
    `date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `payments_invoiceId_idx`(`invoiceId`),
    INDEX `payments_ownerId_date_idx`(`ownerId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `expenses_ownerId_date_idx` ON `expenses`(`ownerId`, `date`);

-- CreateIndex
CREATE INDEX `expenses_ownerId_category_idx` ON `expenses`(`ownerId`, `category`);

-- CreateIndex
CREATE INDEX `expenses_buildingId_idx` ON `expenses`(`buildingId`);

-- CreateIndex
CREATE INDEX `flats_status_idx` ON `flats`(`status`);

-- AddForeignKey
ALTER TABLE `tenants` ADD CONSTRAINT `tenants_flatId_fkey` FOREIGN KEY (`flatId`) REFERENCES `flats`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tenants` ADD CONSTRAINT `tenants_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `meter_readings` ADD CONSTRAINT `meter_readings_flatId_fkey` FOREIGN KEY (`flatId`) REFERENCES `flats`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `meter_readings` ADD CONSTRAINT `meter_readings_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_flatId_fkey` FOREIGN KEY (`flatId`) REFERENCES `flats`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `invoices`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_buildingId_fkey` FOREIGN KEY (`buildingId`) REFERENCES `buildings`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
