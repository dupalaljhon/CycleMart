-- Moderator Applications Table Setup with Admin Account Linking
-- This script creates the table if it doesn't exist and adds the admin_account_id column
-- Foreign keys are omitted for compatibility - the application handles referential integrity

-- Create the moderator_applications table if it doesn't exist
CREATE TABLE IF NOT EXISTS moderator_applications (
    application_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    reason TEXT NOT NULL,
    experience TEXT,
    status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    admin_account_id INT UNSIGNED NULL COMMENT 'ID of admin account created when approved',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_status (status),
    INDEX idx_admin_account_id (admin_account_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add admin_account_id column if it doesn't exist (for existing tables)
SET @dbname = DATABASE();
SET @tablename = 'moderator_applications';
SET @columnname = 'admin_account_id';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE (table_name = @tablename)
   AND (table_schema = @dbname)
   AND (column_name = @columnname)) > 0,
  'SELECT "Column admin_account_id already exists" as message',
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' INT UNSIGNED NULL COMMENT "ID of admin account created when approved" AFTER status')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;
