<?php
require_once "global.php";

class Get extends GlobalMethods {
    private $pdo;

    public function __construct(\PDO $pdo) {
        $this->pdo = $pdo;
    }

    /**
     * Executes a SELECT query and returns a consistent API response.
     *
     * @param string $sql  - SQL query
     * @param array  $params - optional parameters for prepared statement
     * @return array
     */
    public function executeQuery($sql, $params = []) {
        $data = [];
        $errmsg = "";
        $code = 0;

        try {
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute($params);

            $result = $stmt->fetchAll(\PDO::FETCH_ASSOC);

            if ($result && count($result) > 0) {
                // Normalize all keys to lowercase
                $normalized = array_map(function($row) {
                    return array_change_key_case($row, CASE_LOWER);
                }, $result);

                $data = $normalized;
                $code = 200;
            } else {
                $errmsg = "No records found";
                $code = 404;
            }
        } catch (\PDOException $e) {
            $errmsg = $e->getMessage();
            $code = 500; // internal server error
        }

        return [
            "status"  => $code === 200 ? "success" : "error",
            "code"    => $code,
            "message" => $errmsg,
            "data"    => $data
        ];
    }

    /**
     * Get user by ID (helper function for routes)
     */
    public function getUserById($id) {
        $sql = "SELECT id, full_name, email, phone, street, barangay, city, province, profile_image, terms_accepted, is_verified, verification_token, token_expires_at, created_at, updated_at
                FROM users 
                WHERE id = :id";

        return $this->executeQuery($sql, [':id' => $id]);
    }

    /**
     * Get all users for admin management
     */
    public function getAllUsers() {
        $sql = "SELECT id, full_name, email, phone, street, barangay, city, province, profile_image, terms_accepted, is_verified, verification_token, token_expires_at, created_at, updated_at
                FROM users 
                ORDER BY created_at DESC";

        return $this->executeQuery($sql);
    }


    //get all products
    public function getProductsByUser($uploader_id) {
        $sql = "SELECT * FROM products WHERE uploader_id = :uploader_id ORDER BY created_at DESC";
        return $this->executeQuery($sql, [':uploader_id' => $uploader_id]);
    }

    // Get single product by ID
    public function getProductById($product_id) {
        $sql = "SELECT p.*, u.full_name as seller_name, u.email as seller_email, u.profile_image as seller_profile_image 
                FROM products p 
                LEFT JOIN users u ON p.uploader_id = u.id 
                WHERE p.product_id = :product_id";
        return $this->executeQuery($sql, [':product_id' => $product_id]);
    }

    // Get all active products for home page
    public function getAllActiveProducts() {
        $sql = "SELECT p.*, u.full_name as seller_name, u.email as seller_email, u.profile_image as seller_profile_image 
                FROM products p 
                LEFT JOIN users u ON p.uploader_id = u.id 
                WHERE p.status = 'active' AND p.sale_status = 'available' 
                ORDER BY p.created_at DESC";
        return $this->executeQuery($sql);
    }

    // Get all products for admin monitoring
    public function getAllProductsForAdmin() {
        $sql = "SELECT p.*, u.full_name as seller_name, u.email as seller_email, u.profile_image as seller_profile_image 
                FROM products p 
                LEFT JOIN users u ON p.uploader_id = u.id 
                ORDER BY p.created_at DESC";
        return $this->executeQuery($sql);
    }

    /**
     * Get all administrators
     */
    public function getAllAdmins() {
        $sql = "SELECT admin_id, username, email, full_name, role, status, created_at, updated_at
                FROM admins 
                ORDER BY created_at DESC";
        return $this->executeQuery($sql);
    }

    /**
     * Get admin by ID
     */
    public function getAdminById($admin_id) {
        $sql = "SELECT admin_id, username, email, full_name, role, status, created_at, updated_at
                FROM admins 
                WHERE admin_id = :admin_id";
        return $this->executeQuery($sql, [':admin_id' => $admin_id]);
    }

    /**
     * Get user conversations
     */
    public function getUserConversations($user_id) {
        $sql = "SELECT c.conversation_id, c.product_id, c.buyer_id, c.seller_id, c.created_at,
                       p.product_name, p.product_images, p.price,
                       CASE 
                           WHEN c.buyer_id = :user_id1 THEN seller.full_name 
                           ELSE buyer.full_name 
                       END as other_user_name,
                       CASE 
                           WHEN c.buyer_id = :user_id2 THEN seller.profile_image 
                           ELSE buyer.profile_image 
                       END as other_user_avatar,
                       CASE 
                           WHEN c.buyer_id = :user_id3 THEN c.seller_id 
                           ELSE c.buyer_id 
                       END as other_user_id,
                       (SELECT message_text FROM messages WHERE conversation_id = c.conversation_id ORDER BY created_at DESC LIMIT 1) as last_message,
                       (SELECT created_at FROM messages WHERE conversation_id = c.conversation_id ORDER BY created_at DESC LIMIT 1) as last_message_time,
                       (SELECT COUNT(*) FROM messages WHERE conversation_id = c.conversation_id AND sender_id != :user_id4 AND is_read = 0) as unread_count
                FROM conversations c
                LEFT JOIN products p ON c.product_id = p.product_id
                LEFT JOIN users buyer ON c.buyer_id = buyer.id
                LEFT JOIN users seller ON c.seller_id = seller.id
                WHERE (c.buyer_id = :user_id5 OR c.seller_id = :user_id6)
                AND (
                    (c.buyer_id = :user_id7 AND c.buyer_archived = 0 AND c.buyer_deleted = 0) OR
                    (c.seller_id = :user_id8 AND c.seller_archived = 0 AND c.seller_deleted = 0)
                )
                ORDER BY last_message_time DESC";
        
        return $this->executeQuery($sql, [
            ':user_id1' => $user_id,
            ':user_id2' => $user_id,
            ':user_id3' => $user_id,
            ':user_id4' => $user_id,
            ':user_id5' => $user_id,
            ':user_id6' => $user_id,
            ':user_id7' => $user_id,
            ':user_id8' => $user_id
        ]);
    }

    /**
     * Get user archived conversations
     */
    public function getUserArchivedConversations($user_id) {
        $sql = "SELECT c.conversation_id, c.product_id, c.buyer_id, c.seller_id, c.created_at,
                       p.product_name, p.product_images, p.price,
                       CASE 
                           WHEN c.buyer_id = :user_id1 THEN seller.full_name 
                           ELSE buyer.full_name 
                       END as other_user_name,
                       CASE 
                           WHEN c.buyer_id = :user_id2 THEN seller.profile_image 
                           ELSE buyer.profile_image 
                       END as other_user_avatar,
                       CASE 
                           WHEN c.buyer_id = :user_id3 THEN c.seller_id 
                           ELSE c.buyer_id 
                       END as other_user_id,
                       (SELECT message_text FROM messages WHERE conversation_id = c.conversation_id ORDER BY created_at DESC LIMIT 1) as last_message,
                       (SELECT created_at FROM messages WHERE conversation_id = c.conversation_id ORDER BY created_at DESC LIMIT 1) as last_message_time,
                       (SELECT COUNT(*) FROM messages WHERE conversation_id = c.conversation_id AND sender_id != :user_id4 AND is_read = 0) as unread_count
                FROM conversations c
                LEFT JOIN products p ON c.product_id = p.product_id
                LEFT JOIN users buyer ON c.buyer_id = buyer.id
                LEFT JOIN users seller ON c.seller_id = seller.id
                WHERE (c.buyer_id = :user_id5 OR c.seller_id = :user_id6)
                AND (
                    (c.buyer_id = :user_id7 AND c.buyer_archived = 1 AND c.buyer_deleted = 0) OR
                    (c.seller_id = :user_id8 AND c.seller_archived = 1 AND c.seller_deleted = 0)
                )
                ORDER BY last_message_time DESC";
        
        return $this->executeQuery($sql, [
            ':user_id1' => $user_id,
            ':user_id2' => $user_id,
            ':user_id3' => $user_id,
            ':user_id4' => $user_id,
            ':user_id5' => $user_id,
            ':user_id6' => $user_id,
            ':user_id7' => $user_id,
            ':user_id8' => $user_id
        ]);
    }

    /**
     * Get conversation messages
     */
    public function getConversationMessages($conversation_id) {
        $sql = "SELECT m.message_id, m.conversation_id, m.sender_id, m.message_text, m.attachments, m.is_read, m.created_at,
                       u.full_name as sender_name, u.profile_image as sender_avatar
                FROM messages m
                LEFT JOIN users u ON m.sender_id = u.id
                WHERE m.conversation_id = :conversation_id
                ORDER BY m.created_at ASC";
        
        $result = $this->executeQuery($sql, [':conversation_id' => $conversation_id]);
        
        // Process attachments for each message
        if ($result['status'] === 'success' && !empty($result['data'])) {
            foreach ($result['data'] as &$message) {
                if (!empty($message['attachments'])) {
                    $attachments = json_decode($message['attachments'], true);
                    if (is_array($attachments)) {
                        // Add full URL paths for attachments
                        foreach ($attachments as &$attachment) {
                            if (isset($attachment['path'])) {
                                $attachment['url'] = 'http://localhost/CycleMart/CycleMart/CycleMart-api/api/' . $attachment['path'];
                            }
                        }
                        $message['attachments'] = $attachments;
                    } else {
                        $message['attachments'] = [];
                    }
                } else {
                    $message['attachments'] = [];
                }
            }
        }
        
        return $result;
    }

    /**
     * Get dashboard statistics
     */
    public function getDashboardStats() {
        try {
            // Get total counts
            $userCount = $this->pdo->query("SELECT COUNT(*) as count FROM users")->fetch()['count'];
            $productCount = $this->pdo->query("SELECT COUNT(*) as count FROM products")->fetch()['count'];
            $reportCount = $this->pdo->query("SELECT COUNT(*) as count FROM reports")->fetch()['count'];

            return [
                "status" => "success",
                "code" => 200,
                "data" => [
                    "total_users" => (int)$userCount,
                    "total_products" => (int)$productCount,
                    "total_reports" => (int)$reportCount
                ]
            ];
        } catch (\PDOException $e) {
            return [
                "status" => "error",
                "code" => 500,
                "message" => $e->getMessage(),
                "data" => []
            ];
        }
    }

    /**
     * Get chart data for dashboard
     */
    public function getChartData() {
        try {
            // 1. Monthly Growth Data (Users & Products)
            $monthlyGrowthSql = "
                SELECT 
                    DATE_FORMAT(month_series.month, '%Y-%m') as month,
                    COALESCE(users.count, 0) as users,
                    COALESCE(products.count, 0) as products
                FROM (
                    SELECT DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL seq MONTH), '%Y-%m-01') as month
                    FROM (
                        SELECT 0 as seq UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION 
                        SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION 
                        SELECT 8 UNION SELECT 9 UNION SELECT 10 UNION SELECT 11
                    ) as months
                    WHERE DATE_SUB(CURDATE(), INTERVAL seq MONTH) >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
                ) as month_series
                LEFT JOIN (
                    SELECT DATE_FORMAT(created_at, '%Y-%m') as month, COUNT(*) as count
                    FROM users 
                    WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
                    GROUP BY DATE_FORMAT(created_at, '%Y-%m')
                ) as users ON DATE_FORMAT(month_series.month, '%Y-%m') = users.month
                LEFT JOIN (
                    SELECT DATE_FORMAT(created_at, '%Y-%m') as month, COUNT(*) as count
                    FROM products 
                    WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
                    GROUP BY DATE_FORMAT(created_at, '%Y-%m')
                ) as products ON DATE_FORMAT(month_series.month, '%Y-%m') = products.month
                ORDER BY month_series.month
            ";

            // 2. Product Categories Distribution
            $categoriesSql = "
                SELECT 
                    COALESCE(category, 'Uncategorized') as category, 
                    COUNT(*) as count
                FROM products 
                GROUP BY category
                ORDER BY count DESC
            ";

            // 3. Reports by Reason Type
            $reportsSql = "
                SELECT 
                    reason_type, 
                    COUNT(*) as count
                FROM reports 
                GROUP BY reason_type
                ORDER BY count DESC
            ";

            // 4. Top 5 Highest Rated Sellers
            $sellersSql = "
                SELECT 
                    u.full_name as seller_name,
                    u.id as seller_id,
                    ROUND(AVG((r.communication_rating + r.product_rating + r.app_help_rating) / 3), 1) as average_rating,
                    COUNT(r.rating_id) as total_ratings
                FROM users u
                INNER JOIN ratings r ON u.id = r.rated_user_id
                GROUP BY u.id, u.full_name
                HAVING COUNT(r.rating_id) >= 1
                ORDER BY average_rating DESC, total_ratings DESC
                LIMIT 5
            ";

            // Execute queries
            $monthlyGrowth = $this->pdo->query($monthlyGrowthSql)->fetchAll(\PDO::FETCH_ASSOC);
            $categories = $this->pdo->query($categoriesSql)->fetchAll(\PDO::FETCH_ASSOC);
            $reports = $this->pdo->query($reportsSql)->fetchAll(\PDO::FETCH_ASSOC);
            $sellers = $this->pdo->query($sellersSql)->fetchAll(\PDO::FETCH_ASSOC);

            return [
                "status" => "success",
                "code" => 200,
                "data" => [
                    "monthly_growth" => $monthlyGrowth,
                    "product_categories" => $categories,
                    "reports_by_reason" => $reports,
                    "top_sellers" => $sellers
                ]
            ];
        } catch (\PDOException $e) {
            return [
                "status" => "error",
                "code" => 500,
                "message" => $e->getMessage(),
                "data" => []
            ];
        }
    }

    /**
     * Get admin notifications
     */
    public function getAdminNotifications($admin_id, $limit = 10) {
        $sql = "SELECT 
                    n.notification_id,
                    n.type,
                    n.title,
                    n.message,
                    n.reference_id,
                    n.created_at,
                    n.created_by,
                    u.full_name as created_by_name,
                    an.is_read,
                    an.read_at
                FROM notifications n
                INNER JOIN admin_notifications an ON n.notification_id = an.notification_id
                LEFT JOIN users u ON n.created_by = u.id
                WHERE an.admin_id = :admin_id
                ORDER BY n.created_at DESC
                LIMIT :limit";
        
        try {
            $stmt = $this->pdo->prepare($sql);
            $stmt->bindValue(':admin_id', $admin_id, \PDO::PARAM_INT);
            $stmt->bindValue(':limit', $limit, \PDO::PARAM_INT);
            $stmt->execute();
            
            $notifications = $stmt->fetchAll(\PDO::FETCH_ASSOC);
            
            return [
                "status" => "success",
                "code" => 200,
                "data" => $notifications
            ];
        } catch (\PDOException $e) {
            return [
                "status" => "error",
                "code" => 500,
                "message" => $e->getMessage(),
                "data" => []
            ];
        }
    }

    /**
     * Get notification counts for admin
     */
    public function getNotificationCounts($admin_id) {
        try {
            $sql = "SELECT 
                        COUNT(*) as total_notifications,
                        SUM(CASE WHEN an.is_read = 0 THEN 1 ELSE 0 END) as unread_notifications
                    FROM notifications n
                    INNER JOIN admin_notifications an ON n.notification_id = an.notification_id
                    WHERE an.admin_id = :admin_id";
            
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([':admin_id' => $admin_id]);
            $result = $stmt->fetch(\PDO::FETCH_ASSOC);
            
            return [
                "status" => "success",
                "code" => 200,
                "data" => [
                    "total_notifications" => (int)$result['total_notifications'],
                    "unread_notifications" => (int)$result['unread_notifications']
                ]
            ];
        } catch (\PDOException $e) {
            return [
                "status" => "error",
                "code" => 500,
                "message" => $e->getMessage(),
                "data" => []
            ];
        }
    }

    /**
     * Get user ratings (ratings received by a user)
     */
    public function getUserRatings($user_id) {
        $sql = "SELECT r.*, 
                       rater.full_name as buyer_name, 
                       rater.profile_image as buyer_profile_image,
                       p.product_name,
                       p.product_images,
                       p.price as product_price,
                       p.description as product_description,
                       c.conversation_id
                FROM ratings r
                LEFT JOIN users rater ON r.rated_by = rater.id
                LEFT JOIN products p ON r.product_id = p.product_id
                LEFT JOIN conversations c ON r.conversation_id = c.conversation_id
                WHERE r.rated_user_id = :user_id
                ORDER BY r.created_at DESC";
        
        return $this->executeQuery($sql, [':user_id' => $user_id]);
    }

    /**
     * Get conversation rating (check if user has already rated)
     */
    public function getConversationRating($conversation_id, $rated_by) {
        $sql = "SELECT r.*, 
                       rated_user.full_name as rated_user_name,
                       rater.full_name as rater_name
                FROM ratings r
                LEFT JOIN users rated_user ON r.rated_user_id = rated_user.id
                LEFT JOIN users rater ON r.rated_by = rater.id
                WHERE r.conversation_id = :conversation_id AND r.rated_by = :rated_by";
        
        return $this->executeQuery($sql, [
            ':conversation_id' => $conversation_id,
            ':rated_by' => $rated_by
        ]);
    }

    /**
     * Get average ratings for a user
     */
    public function getUserAverageRatings($user_id) {
        $sql = "SELECT 
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
                WHERE rated_user_id = :user_id";
        
        return $this->executeQuery($sql, [':user_id' => $user_id]);
    }

    /**
     * Get all sellers with their average ratings
     */
    public function getAllSellersWithRatings() {
        $sql = "SELECT 
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
                    AVG(r.communication_rating) as avg_communication,
                    AVG(r.product_rating) as avg_product,
                    AVG(r.app_help_rating) as avg_app_help
                FROM users u
                LEFT JOIN ratings r ON u.id = r.rated_user_id
                GROUP BY u.id, u.full_name, u.profile_image
                HAVING COUNT(r.rating_id) > 0
                ORDER BY average_stars DESC";
        
        return $this->executeQuery($sql);
    }

}
