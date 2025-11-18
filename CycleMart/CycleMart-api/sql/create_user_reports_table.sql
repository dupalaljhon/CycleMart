-- Create user_reports table for tracking reports between users
-- This table is used to store reports submitted by users about other users

CREATE TABLE IF NOT EXISTS `user_reports` (
  `report_id` int(11) NOT NULL AUTO_INCREMENT,
  `reported_user_id` int(11) NOT NULL,
  `reported_by` int(11) NOT NULL,
  `reason_type` enum('harassment','spam','inappropriate_behavior','fake_profile','scam','other') NOT NULL,
  `reason_details` text DEFAULT NULL,
  `status` enum('pending','under_review','resolved','dismissed') DEFAULT 'pending',
  `admin_notes` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE current_timestamp(),
  PRIMARY KEY (`report_id`),
  KEY `idx_reported_user` (`reported_user_id`),
  KEY `idx_reported_by` (`reported_by`),
  KEY `idx_status` (`status`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `fk_user_reports_reported_user` FOREIGN KEY (`reported_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_user_reports_reporter` FOREIGN KEY (`reported_by`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Add indexes for better query performance
CREATE INDEX `idx_reason_type` ON `user_reports` (`reason_type`);
CREATE INDEX `idx_combined_status_created` ON `user_reports` (`status`, `created_at`);
