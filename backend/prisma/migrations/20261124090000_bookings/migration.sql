-- AlterTable
ALTER TABLE `documents` ADD COLUMN `bookingId` BIGINT NULL;

-- AlterTable
ALTER TABLE `vehicles` MODIFY `status` ENUM('AVAILABLE', 'ON_LEASE', 'OFF_ROAD', 'ON_TRIP') NOT NULL DEFAULT 'AVAILABLE';

-- CreateTable
CREATE TABLE `bookings` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `orgId` BIGINT NOT NULL,
    `vehicleId` BIGINT NOT NULL,
    `tenantId` BIGINT NOT NULL,
    `invoiceId` BIGINT NULL,
    `status` ENUM('RESERVED', 'ON_TRIP', 'DONE', 'CANCELLED') NOT NULL DEFAULT 'RESERVED',
    `driverName` VARCHAR(100) NULL,
    `driverPhone` VARCHAR(20) NULL,
    `pickup` VARCHAR(255) NULL,
    `destination` VARCHAR(255) NULL,
    `outstation` BOOLEAN NOT NULL DEFAULT false,
    `startAt` DATETIME(3) NOT NULL,
    `endAt` DATETIME(3) NOT NULL,
    `dayRate` DECIMAL(12, 2) NOT NULL,
    `hourCap` INTEGER NOT NULL DEFAULT 10,
    `kmCap` INTEGER NULL,
    `overtimeRate` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `extraKmRate` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `fuelPerKm` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `startKm` INTEGER NULL,
    `endKm` INTEGER NULL,
    `startedAt` DATETIME(3) NULL,
    `endedAt` DATETIME(3) NULL,
    `extras` JSON NULL,
    `cancelCharge` DECIMAL(12, 2) NULL,
    `notes` TEXT NULL,
    `createdById` BIGINT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `bookings_invoiceId_key`(`invoiceId`),
    INDEX `bookings_orgId_vehicleId_startAt_idx`(`orgId`, `vehicleId`, `startAt`),
    INDEX `bookings_tenantId_idx`(`tenantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `documents_bookingId_idx` ON `documents`(`bookingId`);

-- AddForeignKey
ALTER TABLE `documents` ADD CONSTRAINT `documents_bookingId_fkey` FOREIGN KEY (`bookingId`) REFERENCES `bookings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_orgId_fkey` FOREIGN KEY (`orgId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_vehicleId_fkey` FOREIGN KEY (`vehicleId`) REFERENCES `vehicles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `invoices`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `memberships`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

