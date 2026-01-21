-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `username` VARCHAR(191) NOT NULL,
    `firstName` VARCHAR(191) NULL,
    `lastName` VARCHAR(191) NULL,
    `password` VARCHAR(191) NOT NULL,
    `role` ENUM('USER', 'ADMIN') NOT NULL DEFAULT 'USER',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `addressLine1` VARCHAR(191) NULL,
    `addressLine2` VARCHAR(191) NULL,
    `city` VARCHAR(191) NULL,
    `postCode` VARCHAR(191) NULL,
    `country` VARCHAR(191) NULL,
    `stripeCustomerId` VARCHAR(191) NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    UNIQUE INDEX `User_username_key`(`username`),
    UNIQUE INDEX `User_stripeCustomerId_key`(`stripeCustomerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Product` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `type` ENUM('VPS', 'GAME_SERVER', 'WEB_HOSTING') NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `stock` INTEGER NOT NULL,
    `specs` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProductPrice` (
    `id` VARCHAR(191) NOT NULL,
    `billingCycle` ENUM('MONTHLY', 'QUARTERLY', 'ANNUALLY') NOT NULL,
    `price` DECIMAL(65, 30) NOT NULL,
    `stripePriceId` VARCHAR(191) NULL,
    `productId` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Order` (
    `id` VARCHAR(191) NOT NULL,
    `totalAmount` DECIMAL(65, 30) NOT NULL,
    `billingCycle` ENUM('MONTHLY', 'QUARTERLY', 'ANNUALLY') NOT NULL DEFAULT 'MONTHLY',
    `stripeSubscriptionId` VARCHAR(191) NULL,
    `status` ENUM('PENDING', 'ACTIVE', 'SUSPENDED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `paidUntil` DATETIME(3) NULL,
    `userId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `Order_stripeSubscriptionId_key`(`stripeSubscriptionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Service` (
    `id` VARCHAR(191) NOT NULL,
    `hostname` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'BUILDING', 'RUNNING', 'STOPPED', 'SUSPENDED', 'DELETING') NOT NULL DEFAULT 'PENDING',
    `osVersionId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `vmid` INTEGER NULL,
    `node` VARCHAR(191) NULL,
    `userId` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `ipAddressId` INTEGER NULL,

    UNIQUE INDEX `Service_vmid_key`(`vmid`),
    UNIQUE INDEX `Service_orderId_key`(`orderId`),
    UNIQUE INDEX `Service_ipAddressId_key`(`ipAddressId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `IpAddress` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `ipAddress` VARCHAR(191) NOT NULL,
    `gateway` VARCHAR(191) NOT NULL,
    `location` VARCHAR(191) NOT NULL,
    `status` ENUM('AVAILABLE', 'RESERVED', 'IN_USE') NOT NULL DEFAULT 'AVAILABLE',
    `virtualMac` VARCHAR(191) NULL,

    UNIQUE INDEX `IpAddress_ipAddress_key`(`ipAddress`),
    UNIQUE INDEX `IpAddress_virtualMac_key`(`virtualMac`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OperatingSystem` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `imageUrl` VARCHAR(191) NULL,
    `type` VARCHAR(191) NOT NULL DEFAULT 'linux',

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OsVersion` (
    `id` VARCHAR(191) NOT NULL,
    `version` VARCHAR(191) NOT NULL,
    `proxmoxTemplateId` INTEGER NOT NULL,
    `cloudInitUser` VARCHAR(191) NOT NULL DEFAULT 'ubuntu',
    `osId` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ProductPrice` ADD CONSTRAINT `ProductPrice_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Order` ADD CONSTRAINT `Order_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Order` ADD CONSTRAINT `Order_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Service` ADD CONSTRAINT `Service_osVersionId_fkey` FOREIGN KEY (`osVersionId`) REFERENCES `OsVersion`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Service` ADD CONSTRAINT `Service_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Service` ADD CONSTRAINT `Service_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Service` ADD CONSTRAINT `Service_ipAddressId_fkey` FOREIGN KEY (`ipAddressId`) REFERENCES `IpAddress`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OsVersion` ADD CONSTRAINT `OsVersion_osId_fkey` FOREIGN KEY (`osId`) REFERENCES `OperatingSystem`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
