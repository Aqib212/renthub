-- AlterTable
ALTER TABLE `organizations` ADD COLUMN `gateway` JSON NULL;

-- AlterTable
ALTER TABLE `payment_claims` MODIFY `method` ENUM('CASH', 'BKASH', 'NAGAD', 'ROCKET', 'BANK', 'CHEQUE', 'DEPOSIT', 'TDS', 'ONLINE') NOT NULL;

-- AlterTable
ALTER TABLE `payments` MODIFY `method` ENUM('CASH', 'BKASH', 'NAGAD', 'ROCKET', 'BANK', 'CHEQUE', 'DEPOSIT', 'TDS', 'ONLINE') NOT NULL;

-- CreateTable
CREATE TABLE `online_payments` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `orgId` BIGINT NOT NULL,
    `invoiceId` BIGINT NOT NULL,
    `tranId` VARCHAR(40) NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `status` ENUM('INITIATED', 'PAID', 'FAILED', 'CANCELLED') NOT NULL DEFAULT 'INITIATED',
    `valId` VARCHAR(100) NULL,
    `cardType` VARCHAR(50) NULL,
    `bankTranId` VARCHAR(100) NULL,
    `paymentId` BIGINT NULL,
    `raw` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `online_payments_tranId_key`(`tranId`),
    UNIQUE INDEX `online_payments_paymentId_key`(`paymentId`),
    INDEX `online_payments_invoiceId_idx`(`invoiceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `online_payments` ADD CONSTRAINT `online_payments_orgId_fkey` FOREIGN KEY (`orgId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `online_payments` ADD CONSTRAINT `online_payments_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `invoices`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `online_payments` ADD CONSTRAINT `online_payments_paymentId_fkey` FOREIGN KEY (`paymentId`) REFERENCES `payments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

