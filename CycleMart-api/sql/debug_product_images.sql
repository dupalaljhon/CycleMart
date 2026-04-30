-- Test query to debug product images issue
-- This query helps understand the product_images data format

-- Check products with ratings to see image data
SELECT 
    r.rating_id,
    p.product_id,
    p.product_name,
    p.product_images,
    LENGTH(p.product_images) as image_data_length,
    r.rated_user_id,
    u.full_name as seller_name
FROM ratings r
LEFT JOIN products p ON r.product_id = p.product_id  
LEFT JOIN users u ON r.rated_user_id = u.id
WHERE r.product_id IS NOT NULL
ORDER BY r.created_at DESC
LIMIT 5;

-- Check all products to see image format
SELECT 
    product_id,
    product_name,
    product_images,
    uploader_id,
    created_at
FROM products 
WHERE product_images IS NOT NULL 
  AND product_images != '' 
  AND product_images != '[]'
ORDER BY created_at DESC
LIMIT 10;

-- Sample product image data format (what it should look like)
/*
Expected format in product_images column:
["uploads/prod_12345.jpg", "uploads/prod_12346.jpg"]
OR
["http://localhost/CycleMart/uploads/prod_12345.jpg"]
OR
[{"path": "uploads/prod_12345.jpg", "name": "product1.jpg"}]
*/