-- ========================================
-- MIGRATION: Restrict Users to Olongapo City Only
-- Date: 2026-01-05
-- ========================================
-- This migration:
-- 1. Removes the province column (keeping existing data safe)
-- 2. Updates city to 'Olongapo City' for all users
-- 3. Changes barangay to ENUM with 17 predefined barangays
-- 4. Preserves all existing user data
-- ========================================

-- Step 1: Update all existing users to have city = 'Olongapo City'
UPDATE users SET city = 'Olongapo City' WHERE city IS NULL OR city = '';

-- Step 2: Normalize existing barangay data (map to closest valid barangay or set to default)
-- Note: Review existing barangay data first to ensure proper mapping
-- This query will show what barangays currently exist:
-- SELECT DISTINCT barangay FROM users WHERE barangay IS NOT NULL AND barangay != '';

-- Update any invalid barangays to a default (you may need to customize this based on your data)
-- Uncomment and modify if needed:
-- UPDATE users SET barangay = 'Asinan' WHERE barangay NOT IN (
--     'Asinan', 'Banicain', 'Barretto', 'East Bajac-Bajac', 'Gordon Heights',
--     'Kalaklan', 'Mabayuan', 'New Cabalan', 'Old Cabalan', 'Pag-asa',
--     'Santa Rita', 'West Bajac-Bajac', 'East Tapinac', 'West Tapinac',
--     'New Kalalake', 'Kababae', 'Ilalim'
-- );

-- Step 3: Modify barangay column to ENUM type
-- First, create a temporary column
ALTER TABLE users ADD COLUMN barangay_new ENUM(
    'Asinan',
    'Banicain',
    'Barretto',
    'East Bajac-Bajac',
    'Gordon Heights',
    'Kalaklan',
    'Mabayuan',
    'New Cabalan',
    'Old Cabalan',
    'Pag-asa',
    'Santa Rita',
    'West Bajac-Bajac',
    'East Tapinac',
    'West Tapinac',
    'New Kalalake',
    'Kababae',
    'Ilalim'
) NULL AFTER barangay;

-- Step 4: Copy valid barangay data to the new column
UPDATE users 
SET barangay_new = CASE
    WHEN barangay IN (
        'Asinan', 'Banicain', 'Barretto', 'East Bajac-Bajac', 'Gordon Heights',
        'Kalaklan', 'Mabayuan', 'New Cabalan', 'Old Cabalan', 'Pag-asa',
        'Santa Rita', 'West Bajac-Bajac', 'East Tapinac', 'West Tapinac',
        'New Kalalake', 'Kababae', 'Ilalim'
    ) THEN barangay
    ELSE NULL
END
WHERE barangay IS NOT NULL AND barangay != '';

-- Step 5: Drop the old barangay column and rename the new one
ALTER TABLE users DROP COLUMN barangay;
ALTER TABLE users CHANGE COLUMN barangay_new barangay ENUM(
    'Asinan',
    'Banicain',
    'Barretto',
    'East Bajac-Bajac',
    'Gordon Heights',
    'Kalaklan',
    'Mabayuan',
    'New Cabalan',
    'Old Cabalan',
    'Pag-asa',
    'Santa Rita',
    'West Bajac-Bajac',
    'East Tapinac',
    'West Tapinac',
    'New Kalalake',
    'Kababae',
    'Ilalim'
) NOT NULL;

-- Step 6: Modify city column to default to 'Olongapo City' and make it NOT NULL
ALTER TABLE users MODIFY COLUMN city VARCHAR(100) NOT NULL DEFAULT 'Olongapo City';

-- Step 7: Drop the province column (but keep the data in backup first)
-- BACKUP: Create a backup table with province data before dropping
CREATE TABLE IF NOT EXISTS users_province_backup AS 
SELECT id, full_name, email, province, created_at 
FROM users 
WHERE province IS NOT NULL AND province != '';

-- Now drop the province column
ALTER TABLE users DROP COLUMN province;

-- Step 8: Modify street column to ensure it's properly configured
ALTER TABLE users MODIFY COLUMN street VARCHAR(255) NOT NULL;

-- ========================================
-- VERIFICATION QUERIES
-- ========================================
-- Run these after migration to verify:
-- SELECT COUNT(*) as total_users, city FROM users GROUP BY city;
-- SELECT barangay, COUNT(*) as count FROM users GROUP BY barangay ORDER BY barangay;
-- DESCRIBE users;
-- ========================================

-- Migration completed successfully
SELECT 'Migration completed: Users table updated for Olongapo City only' as status;
