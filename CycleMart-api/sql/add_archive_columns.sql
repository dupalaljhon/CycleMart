-- Migration to add archive tracking columns to products table
-- Run this SQL script in your database

-- Add is_archived column (tinyint for boolean compatibility)
ALTER TABLE `products` 
ADD COLUMN `is_archived` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '0 = not archived, 1 = archived' AFTER `status`;

-- Add archive_reason column to store why product was archived
ALTER TABLE `products` 
ADD COLUMN `archive_reason` TEXT NULL COMMENT 'Reason for archiving the product' AFTER `is_archived`;

-- Add archived_at timestamp
ALTER TABLE `products` 
ADD COLUMN `archived_at` TIMESTAMP NULL COMMENT 'When the product was archived' AFTER `archive_reason`;

-- Add archived_by to track which admin archived it
ALTER TABLE `products` 
ADD COLUMN `archived_by` INT(11) NULL COMMENT 'Admin ID who archived the product' AFTER `archived_at`;

-- Add index for better query performance
ALTER TABLE `products` 
ADD INDEX `idx_is_archived` (`is_archived`);

-- Update existing archived products to have is_archived = 1
UPDATE `products` SET `is_archived` = 1 WHERE `status` = 'archived';

-- Verify changes
SELECT * FROM `products` LIMIT 5;
