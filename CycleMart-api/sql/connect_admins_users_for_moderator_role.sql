-- Connect the "user side" and "admin side" for moderators
--
-- Goal:
-- - Ensure user accounts that are approved moderators have users.role='moderator'
-- - Add a stable link from admins -> users via admins.user_id (so you don't rely on email matching)
-- - Backfill admins.user_id using moderator_applications (authoritative), then fallback to matching by email
--
-- Tested against your dump structure (cyclemart (22).sql):
-- - users(id, ..., role enum('user','moderator','admin') default 'user')
-- - admins(admin_id, ..., role enum('super_admin','moderator','support'))
-- - moderator_applications(user_id, admin_account_id, status)
--
-- Run in phpMyAdmin or MySQL client while selected DB is `cyclemart`.

START TRANSACTION;

-- 1) Ensure users.role exists (older DBs may not have it)
SET @users_role_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'role'
);
SET @sql := IF(
  @users_role_exists = 0,
  "ALTER TABLE users ADD COLUMN role ENUM('user','moderator','admin') DEFAULT 'user'",
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2) Ensure admins.user_id exists (the actual linkage between admin identity and user identity)
SET @admins_user_id_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'admins'
    AND COLUMN_NAME = 'user_id'
);
SET @sql := IF(
  @admins_user_id_exists = 0,
  'ALTER TABLE admins ADD COLUMN user_id INT(11) NULL AFTER admin_id',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3) Add an index for faster lookups (safe even if lots of data)
SET @idx_exists := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'admins'
    AND INDEX_NAME = 'idx_admins_user_id'
);
SET @sql := IF(
  @idx_exists = 0,
  'CREATE INDEX idx_admins_user_id ON admins(user_id)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 4) Backfill: every APPROVED moderator application makes the user a moderator
UPDATE users u
JOIN moderator_applications ma ON ma.user_id = u.id
SET u.role = 'moderator'
WHERE ma.status = 'approved'
  AND (u.role IS NULL OR u.role <> 'moderator');

-- 5) Backfill admins.user_id using the authoritative mapping from moderator_applications
-- If your approval flow populated moderator_applications.admin_account_id, this is the best link.
UPDATE admins a
JOIN moderator_applications ma ON ma.admin_account_id = a.admin_id
SET a.user_id = ma.user_id
WHERE ma.status = 'approved'
  AND a.user_id IS NULL;

-- 6) Fallback backfill by email match (covers older/moderator admins created outside the application)
UPDATE admins a
JOIN users u ON u.email = a.email
SET a.user_id = u.id
WHERE a.user_id IS NULL;

COMMIT;

-- Optional: quick verification queries
-- See which approved moderators are linked on BOTH sides
-- SELECT u.id AS user_id, u.email, u.full_name, u.role AS user_role,
--        a.admin_id, a.username, a.role AS admin_role, a.user_id AS admin_user_id
-- FROM users u
-- JOIN moderator_applications ma ON ma.user_id = u.id AND ma.status = 'approved'
-- LEFT JOIN admins a ON a.user_id = u.id
-- ORDER BY u.id;

-- Find admins with no linked user (not necessarily a problem for super_admin accounts)
-- SELECT admin_id, username, email, role, user_id
-- FROM admins
-- WHERE user_id IS NULL
-- ORDER BY admin_id;
