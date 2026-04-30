-- Test SQL Query for Seller Average Ratings in CycleMart Database
-- This query calculates each seller's average star rating based on three rating fields

-- Query to get all sellers with their average ratings
SELECT 
    u.id as seller_id,
    u.full_name as seller_name,
    u.profile_image,
    ROUND(
        (
            AVG(r.communication_rating) + 
            AVG(r.product_rating) + 
            AVG(r.app_help_rating)
        ) / 3, 1
    ) as average_stars,
    COUNT(r.rating_id) as total_ratings,
    ROUND(AVG(r.communication_rating), 1) as avg_communication,
    ROUND(AVG(r.product_rating), 1) as avg_product,
    ROUND(AVG(r.app_help_rating), 1) as avg_app_help
FROM users u
LEFT JOIN ratings r ON u.id = r.rated_user_id
GROUP BY u.id, u.full_name, u.profile_image
HAVING COUNT(r.rating_id) > 0
ORDER BY average_stars DESC;

-- Query for a specific user's rating (for profile page)
-- Replace :user_id with actual user ID
SELECT 
    AVG(communication_rating) as avg_communication,
    AVG(product_rating) as avg_product,
    AVG(app_help_rating) as avg_app_help,
    ROUND(
        (
            AVG(communication_rating) + 
            AVG(product_rating) + 
            AVG(app_help_rating)
        ) / 3, 1
    ) as average_stars,
    COUNT(*) as total_ratings
FROM ratings 
WHERE rated_user_id = :user_id;

-- Sample INSERT statements to test the rating system
-- (Uncomment and modify these to add test data)

/*
-- Insert some sample ratings for testing
INSERT INTO ratings (conversation_id, rated_by, rated_user_id, product_id, communication_rating, product_rating, app_help_rating, feedback, created_at) VALUES
(1, 2, 1, 1, 5, 4, 5, 'Great seller, very responsive!', NOW()),
(2, 3, 1, 2, 4, 5, 4, 'Product exactly as described.', NOW()),
(3, 4, 1, 3, 5, 5, 5, 'Perfect transaction, highly recommend!', NOW()),
(4, 5, 2, 4, 3, 3, 4, 'Average experience, product was okay.', NOW()),
(5, 6, 2, 5, 4, 4, 3, 'Good communication but app could be better.', NOW());
*/

-- Query to see rating distribution
SELECT 
    rated_user_id,
    u.full_name,
    communication_rating,
    product_rating,
    app_help_rating,
    (communication_rating + product_rating + app_help_rating) / 3 as individual_average
FROM ratings r
JOIN users u ON r.rated_user_id = u.id
ORDER BY rated_user_id, r.created_at DESC;