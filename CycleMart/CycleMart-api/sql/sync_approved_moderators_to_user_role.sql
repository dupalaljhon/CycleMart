-- Sync approved moderator applications into users.role
-- Run this once in phpMyAdmin or MySQL client.
-- Safe: only updates users that have an APPROVED moderator application.

-- Option A (recommended): update ALL approved moderators
UPDATE users u
JOIN moderator_applications ma ON ma.user_id = u.id
SET u.role = 'moderator'
WHERE ma.status = 'approved'
  AND (u.role IS NULL OR u.role <> 'moderator');

-- Option B: update ONE specific user (uncomment and set the user id)
-- UPDATE users u
-- JOIN moderator_applications ma ON ma.user_id = u.id
-- SET u.role = 'moderator'
-- WHERE ma.status = 'approved'
--   AND u.id = 123;

-- Quick check (optional)
-- SELECT u.id, u.email, u.full_name, u.role, ma.status
-- FROM users u
-- JOIN moderator_applications ma ON ma.user_id = u.id
-- WHERE ma.status = 'approved';
