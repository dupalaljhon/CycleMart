-- Create product_specifications table
-- This table stores optional specifications for products as key-value pairs

CREATE TABLE IF NOT EXISTS product_specifications (
  spec_id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  spec_name VARCHAR(100) NOT NULL,
  spec_value VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE,
  INDEX idx_product_id (product_id)
);

-- Add some sample data for testing (optional)
-- INSERT INTO product_specifications (product_id, spec_name, spec_value) VALUES
-- (1, 'Frame Material', 'Carbon Fiber'),
-- (1, 'Weight', '8.5 kg'),
-- (1, 'Wheel Size', '700c'),
-- (2, 'Brand', 'Shimano'),
-- (2, 'Speed', '11-speed');