-- Create user_notifications table for user-facing notifications
-- This table stores notifications sent to users (not admins)

CREATE TABLE IF NOT EXISTS `user_notifications` (
  `notification_id` INT(11) NOT NULL AUTO_INCREMENT,
  `user_id` INT(11) NOT NULL COMMENT 'User who receives this notification',
  `type` VARCHAR(50) NOT NULL COMMENT 'Type of notification (e.g., product_archived, message_received, etc.)',
  `title` VARCHAR(255) NOT NULL COMMENT 'Notification title',
  `message` TEXT NOT NULL COMMENT 'Notification message content',
  `reference_id` INT(11) NULL COMMENT 'Reference to related entity (e.g., product_id, conversation_id)',
  `is_read` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '0 = unread, 1 = read',
  `read_at` TIMESTAMP NULL COMMENT 'When the notification was read',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'When notification was created',
  PRIMARY KEY (`notification_id`),
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_is_read` (`is_read`),
  INDEX `idx_created_at` (`created_at`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Verify table creation
DESCRIBE `user_notifications`;
