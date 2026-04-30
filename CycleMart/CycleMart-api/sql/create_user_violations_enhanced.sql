-- Enhanced User Violations Table
-- Tracks inappropriate listings and enforces progressive restrictions

CREATE TABLE IF NOT EXISTS user_violations (
  violation_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  
  -- Type of violation
  violation_code ENUM(
    'not_bike_related',      -- Item is not related to bicycles
    'prohibited_item',        -- Selling prohibited items
    'spam',                   -- Spam/duplicate listings
    'fraud',                  -- Fraudulent content
    'inappropriate_content',  -- Offensive or inappropriate
    'misleading_info',        -- False information
    'price_manipulation',     -- Unrealistic pricing
    'other'                   -- Other violations
  ) NOT NULL,
  
  -- Progressive discipline level
  violation_level TINYINT NOT NULL DEFAULT 1
    COMMENT '1=warning, 2=restriction(48h), 3=suspension(7days), 4=permanent ban',
  
  -- How the violation was detected
  source ENUM('manual', 'auto') NOT NULL DEFAULT 'manual'
    COMMENT 'manual=admin rejected, auto=system detected',
  
  -- Reference to the rejected product
  related_product_id INT NULL,
  
  -- Current status of this violation
  status ENUM('active', 'resolved', 'expired') NOT NULL DEFAULT 'active'
    COMMENT 'active=currently in effect, resolved=user appealed, expired=time passed',
  
  -- Count of violations of this type
  violation_count INT NOT NULL DEFAULT 1
    COMMENT 'Number of times user violated this specific code',
  
  -- Restriction end time (NULL if no restriction)
  restriction_until DATETIME NULL
    COMMENT 'User cannot create listings until this timestamp',
  
  -- Detailed reason from admin
  rejection_reason TEXT NULL
    COMMENT 'Detailed explanation of why the listing was rejected',
  
  -- Admin who issued the violation
  admin_id INT NULL
    COMMENT 'Admin who manually rejected the listing',
  
  -- Timestamps
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    COMMENT 'When the first violation of this type occurred',
  
  last_violation_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    COMMENT 'When the most recent violation of this type occurred',
  
  -- Indexes for performance
  UNIQUE KEY uniq_user_violation (user_id, violation_code),
  INDEX idx_user (user_id),
  INDEX idx_violation_code (violation_code),
  INDEX idx_level (violation_level),
  INDEX idx_status (status),
  INDEX idx_restriction (restriction_until),
  
  -- Foreign keys
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (admin_id) REFERENCES admins(admin_id) ON DELETE SET NULL,
  FOREIGN KEY (related_product_id) REFERENCES products(product_id) ON DELETE SET NULL
  
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Tracks user violations and enforces progressive restrictions';

-- Create user_restrictions table for detailed restriction history
CREATE TABLE IF NOT EXISTS user_restrictions (
  restriction_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  violation_id INT NOT NULL,
  
  restriction_type ENUM('listing_ban', 'account_suspension', 'permanent_ban') NOT NULL,
  
  reason TEXT NOT NULL,
  
  starts_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NULL,
  
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  
  created_by INT NULL COMMENT 'Admin who created the restriction',
  
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_user (user_id),
  INDEX idx_active (is_active),
  INDEX idx_expiry (expires_at),
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (violation_id) REFERENCES user_violations(violation_id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES admins(admin_id) ON DELETE SET NULL
  
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Detailed history of user restrictions';

-- View to check active restrictions
CREATE OR REPLACE VIEW active_user_restrictions AS
SELECT 
  ur.*,
  uv.violation_code,
  uv.violation_count,
  u.full_name,
  u.email
FROM user_restrictions ur
JOIN user_violations uv ON ur.violation_id = uv.violation_id
JOIN users u ON ur.user_id = u.id
WHERE ur.is_active = TRUE
  AND (ur.expires_at IS NULL OR ur.expires_at > NOW());

-- View to get user violation summary
CREATE OR REPLACE VIEW user_violation_summary AS
SELECT 
  u.id as user_id,
  u.full_name,
  u.email,
  COUNT(DISTINCT uv.violation_id) as total_violation_types,
  SUM(uv.violation_count) as total_violations,
  MAX(uv.violation_level) as highest_level,
  MAX(uv.last_violation_at) as last_violation,
  CASE 
    WHEN EXISTS(
      SELECT 1 FROM user_restrictions ur 
      WHERE ur.user_id = u.id 
      AND ur.is_active = TRUE 
      AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
    ) THEN TRUE 
    ELSE FALSE 
  END as currently_restricted,
  (SELECT MAX(ur.expires_at) FROM user_restrictions ur WHERE ur.user_id = u.id AND ur.is_active = TRUE) as restriction_expires
FROM users u
LEFT JOIN user_violations uv ON u.id = uv.user_id AND uv.status = 'active'
GROUP BY u.id, u.full_name, u.email;
