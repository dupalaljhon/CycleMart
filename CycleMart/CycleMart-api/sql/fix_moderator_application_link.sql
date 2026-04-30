-- Fix the moderator application that was processed but not properly linked
-- Run this if the application status is still "pending" after approval

UPDATE moderator_applications 
SET 
    status = 'approved',
    admin_account_id = 10,  -- The admin_id of the moderator1 account that was created
    reviewed_by = 5,         -- Your admin ID
    reviewed_at = NOW()
WHERE application_id = 1 
AND user_id = 29;

-- Verify the update
SELECT * FROM moderator_applications WHERE application_id = 1;
