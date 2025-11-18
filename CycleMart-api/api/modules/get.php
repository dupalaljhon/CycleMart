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
        $sql = "SELECT * FROM products 
                WHERE uploader_id = :uploader_id AND (is_archived IS NULL OR is_archived = 0)
                ORDER BY created_at DESC";
        $result = $this->executeQuery($sql, [':uploader_id' => $uploader_id]);
        
        // Parse specifications JSON for each product
        if ($result['status'] === 'success' && isset($result['data'])) {
            foreach ($result['data'] as &$product) {
                $product['specifications'] = $this->parseSpecificationsJson($product['specifications'] ?? null);
            }
        }
        
        return $result;
    }

    // Get single product by ID
    public function getProductById($product_id) {
        $sql = "SELECT p.*, u.full_name as seller_name, u.email as seller_email, u.profile_image as seller_profile_image 
                FROM products p 
                JOIN users u ON p.uploader_id = u.id 
                WHERE p.product_id = :product_id";
        $result = $this->executeQuery($sql, [':product_id' => $product_id]);
        
        // Parse specifications JSON for the product
        if ($result['status'] === 'success' && isset($result['data']) && !empty($result['data'])) {
            $result['data'][0]['specifications'] = $this->parseSpecificationsJson($result['data'][0]['specifications'] ?? null);
        }
        
        return $result;
    }

    // Get all active products for home page
    public function getAllActiveProducts() {
        $sql = "SELECT p.*, u.full_name as seller_name, u.email as seller_email, u.profile_image as seller_profile_image 
                FROM products p 
                JOIN users u ON p.uploader_id = u.id 
                WHERE p.status = 'active' AND p.sale_status = 'available' AND (p.is_archived IS NULL OR p.is_archived = 0)
                ORDER BY p.created_at DESC";
        $result = $this->executeQuery($sql);
        
        // Parse specifications JSON for each product
        if ($result['status'] === 'success' && isset($result['data'])) {
            foreach ($result['data'] as &$product) {
                $product['specifications'] = $this->parseSpecificationsJson($product['specifications'] ?? null);
            }
        }
        
        return $result;
    }

    // Get all products for admin monitoring
    public function getAllProductsForAdmin() {
        $sql = "SELECT p.*, u.full_name as seller_name, u.email as seller_email, u.profile_image as seller_profile_image 
                FROM products p 
                JOIN users u ON p.uploader_id = u.id 
                ORDER BY p.created_at DESC";
        $result = $this->executeQuery($sql);
        
        // Parse specifications JSON for each product
        if ($result['status'] === 'success' && isset($result['data'])) {
            foreach ($result['data'] as &$product) {
                $product['specifications'] = $this->parseSpecificationsJson($product['specifications'] ?? null);
            }
        }
        
        return $result;
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
        error_log("🔵🔵🔵 GET CONVERSATION MESSAGES CALLED 🔵🔵🔵");
        error_log("Conversation ID: " . $conversation_id);
        
        $sql = "SELECT m.message_id, m.conversation_id, m.sender_id, m.message_text, m.attachments, m.is_read, m.created_at,
                       CASE 
                           WHEN m.sender_id = 0 THEN 'System'
                           ELSE u.full_name
                       END as sender_name,
                       CASE 
                           WHEN m.sender_id = 0 THEN ''
                           ELSE u.profile_image
                       END as sender_avatar
                FROM messages m
                LEFT JOIN users u ON m.sender_id = u.id AND m.sender_id != 0
                WHERE m.conversation_id = :conversation_id
                ORDER BY m.created_at ASC";
        
        error_log("Executing SQL query for messages...");
        $result = $this->executeQuery($sql, [':conversation_id' => $conversation_id]);
        error_log("Query result status: " . $result['status']);
        error_log("Messages found: " . (isset($result['data']) ? count($result['data']) : 0));
        
        // Process attachments for each message and identify system messages
        if ($result['status'] === 'success' && !empty($result['data'])) {
            foreach ($result['data'] as &$message) {
                // Handle attachments
                if (!empty($message['attachments'])) {
                    $attachments = json_decode($message['attachments'], true);
                    if (is_array($attachments)) {
                        // Add full URL paths for attachments
                        foreach ($attachments as &$attachment) {
                            if (isset($attachment['path'])) {
                                $attachment['url'] = 'http://api.cyclemart.shop/CycleMart-api/api' . $attachment['path'];
                            }
                        }
                        $message['attachments'] = $attachments;
                    } else {
                        $message['attachments'] = [];
                    }
                } else {
                    $message['attachments'] = [];
                }
                
                // Mark system messages and determine type
                if ($message['sender_id'] == 0) {
                    $message['is_system_message'] = true;
                    // Determine system message type from message text
                    $messageText = strtolower($message['message_text']);
                    if (strpos($messageText, 'sold') !== false) {
                        $message['system_message_type'] = 'sold';
                    } else if (strpos($messageText, 'traded') !== false) {
                        $message['system_message_type'] = 'traded';
                    } else {
                        $message['system_message_type'] = 'sold'; // default
                    }
                    
                    error_log("🟢 SYSTEM MESSAGE DETECTED:");
                    error_log("  Message ID: " . $message['message_id']);
                    error_log("  Sender ID: " . $message['sender_id']);
                    error_log("  Type: " . $message['system_message_type']);
                    error_log("  Text preview: " . substr($message['message_text'], 0, 100));
                } else {
                    $message['is_system_message'] = false;
                    $message['system_message_type'] = null;
                }
            }
            
            // Count and log system messages
            $systemCount = 0;
            foreach ($result['data'] as $msg) {
                if (isset($msg['is_system_message']) && $msg['is_system_message']) {
                    $systemCount++;
                }
            }
            error_log("🟢 Total system messages in result: " . $systemCount);
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
            
            // Try to get user reports count (table may not exist)
            $userReportCount = 0;
            try {
                $userReportCount = $this->pdo->query("SELECT COUNT(*) as count FROM user_reports")->fetch()['count'];
            } catch (\PDOException $e) {
                // Table doesn't exist, set to 0
                $userReportCount = 0;
            }
            
            // Get new users (last 7 days)
            $newUsersWeek = $this->pdo->query(
                "SELECT COUNT(*) as count FROM users WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)"
            )->fetch()['count'];
            
            // Get new users (last 24 hours)
            $newUsersDay = $this->pdo->query(
                "SELECT COUNT(*) as count FROM users WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)"
            )->fetch()['count'];
            
            // Get active listings (status = 'active')
            $activeListings = $this->pdo->query(
                "SELECT COUNT(*) as count FROM products WHERE status = 'active'"
            )->fetch()['count'];
            
            // Get new listings (last 7 days)
            $newListingsWeek = $this->pdo->query(
                "SELECT COUNT(*) as count FROM products WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)"
            )->fetch()['count'];
            
            // Get new listings (last 24 hours)
            $newListingsDay = $this->pdo->query(
                "SELECT COUNT(*) as count FROM products WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)"
            )->fetch()['count'];
            
            // Get pending products (status = 'pending')
            $pendingProducts = $this->pdo->query(
                "SELECT COUNT(*) as count FROM products WHERE status = 'pending'"
            )->fetch()['count'];
            
            // Get reports by category
            $productReports = (int)$reportCount;
            $userReports = (int)$userReportCount;
            $totalReportsAll = $productReports + $userReports;
            
            // Get pending reports
            $pendingReports = $this->pdo->query(
                "SELECT COUNT(*) as count FROM reports WHERE status = 'pending'"
            )->fetch()['count'];
            
            // Try to get pending user reports (table may not exist)
            $pendingUserReports = 0;
            try {
                $pendingUserReports = $this->pdo->query(
                    "SELECT COUNT(*) as count FROM user_reports WHERE status = 'pending'"
                )->fetch()['count'];
            } catch (\PDOException $e) {
                $pendingUserReports = 0;
            }
            
            $totalPendingReports = (int)$pendingReports + (int)$pendingUserReports;

            return [
                "status" => "success",
                "code" => 200,
                "data" => [
                    "total_users" => (int)$userCount,
                    "new_users_week" => (int)$newUsersWeek,
                    "new_users_day" => (int)$newUsersDay,
                    "total_products" => (int)$productCount,
                    "active_listings" => (int)$activeListings,
                    "new_listings_week" => (int)$newListingsWeek,
                    "new_listings_day" => (int)$newListingsDay,
                    "pending_products" => (int)$pendingProducts,
                    "total_reports" => $totalReportsAll,
                    "product_reports" => $productReports,
                    "user_reports" => $userReports,
                    "pending_reports" => $totalPendingReports
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
                    COALESCE(product_reason_type, user_reason_type, 'other') as reason_type, 
                    COUNT(*) as count
                FROM reports 
                GROUP BY COALESCE(product_reason_type, user_reason_type, 'other')
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

            // 5. Most Reported Accounts (Users with highest report count)
            $reportedAccountsSql = "
                SELECT 
                    u.id as user_id,
                    u.full_name,
                    u.email,
                    u.account_status,
                    COUNT(r.report_id) as report_count,
                    u.violation_count
                FROM users u
                INNER JOIN reports r ON u.id = r.reported_user_id
                WHERE r.reported_user_id IS NOT NULL
                GROUP BY u.id, u.full_name, u.email, u.account_status, u.violation_count
                ORDER BY report_count DESC, u.violation_count DESC
                LIMIT 10
            ";

            // Execute queries
            $monthlyGrowth = $this->pdo->query($monthlyGrowthSql)->fetchAll(\PDO::FETCH_ASSOC);
            $categories = $this->pdo->query($categoriesSql)->fetchAll(\PDO::FETCH_ASSOC);
            $reports = $this->pdo->query($reportsSql)->fetchAll(\PDO::FETCH_ASSOC);
            $sellers = $this->pdo->query($sellersSql)->fetchAll(\PDO::FETCH_ASSOC);
            $reportedAccounts = $this->pdo->query($reportedAccountsSql)->fetchAll(\PDO::FETCH_ASSOC);

            return [
                "status" => "success",
                "code" => 200,
                "data" => [
                    "monthly_growth" => $monthlyGrowth,
                    "product_categories" => $categories,
                    "reports_by_reason" => $reports,
                    "top_sellers" => $sellers,
                    "most_reported_accounts" => $reportedAccounts
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
     * Get recent activities for admin dashboard
     */
    public function getRecentActivities($limit = 50) {
        try {
            // Check if user_reports table exists
            $userReportsExists = false;
            try {
                $this->pdo->query("SELECT 1 FROM user_reports LIMIT 1");
                $userReportsExists = true;
            } catch (\PDOException $e) {
                $userReportsExists = false;
            }
            
            // Build query based on table existence
            if ($userReportsExists) {
                $sql = "(
                        SELECT 
                            'new_user' as activity_type,
                            u.id as reference_id,
                            u.full_name as user_name,
                            NULL as product_name,
                            NULL as report_type,
                            u.created_at as activity_time,
                            CONCAT('New user registered: ', u.full_name) as activity_message
                        FROM users u
                        WHERE u.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                    )
                    UNION ALL
                    (
                        SELECT 
                            'new_listing' as activity_type,
                            p.product_id as reference_id,
                            u.full_name as user_name,
                            p.product_name as product_name,
                            NULL as report_type,
                            p.created_at as activity_time,
                            CONCAT('New listing posted: ', p.product_name) as activity_message
                        FROM products p
                        INNER JOIN users u ON p.uploader_id = u.id
                        WHERE p.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                    )
                    UNION ALL
                    (
                        SELECT 
                            'new_report' as activity_type,
                            r.report_id as reference_id,
                            u.full_name as user_name,
                            p.product_name as product_name,
                            COALESCE(r.product_reason_type, r.user_reason_type, 'other') as report_type,
                            r.created_at as activity_time,
                            CONCAT(r.report_type, ' report submitted') as activity_message
                        FROM reports r
                        INNER JOIN users u ON r.reporter_id = u.id
                        LEFT JOIN products p ON r.product_id = p.product_id
                        WHERE r.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                    )
                    UNION ALL
                    (
                        SELECT 
                            'new_user_report' as activity_type,
                            ur.report_id as reference_id,
                            u.full_name as user_name,
                            NULL as product_name,
                            ur.reason_type as report_type,
                            ur.created_at as activity_time,
                            CONCAT('User report submitted: ', ur.reason_type) as activity_message
                        FROM user_reports ur
                        INNER JOIN users u ON ur.reported_by = u.id
                        WHERE ur.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                    )
                    ORDER BY activity_time DESC
                    LIMIT :limit";
            } else {
                // Query without user_reports table
                $sql = "(
                        SELECT 
                            'new_user' as activity_type,
                            u.id as reference_id,
                            u.full_name as user_name,
                            NULL as product_name,
                            NULL as report_type,
                            u.created_at as activity_time,
                            CONCAT('New user registered: ', u.full_name) as activity_message
                        FROM users u
                        WHERE u.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                    )
                    UNION ALL
                    (
                        SELECT 
                            'new_listing' as activity_type,
                            p.product_id as reference_id,
                            u.full_name as user_name,
                            p.product_name as product_name,
                            NULL as report_type,
                            p.created_at as activity_time,
                            CONCAT('New listing posted: ', p.product_name) as activity_message
                        FROM products p
                        INNER JOIN users u ON p.uploader_id = u.id
                        WHERE p.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                    )
                    UNION ALL
                    (
                        SELECT 
                            'new_report' as activity_type,
                            r.report_id as reference_id,
                            u.full_name as user_name,
                            p.product_name as product_name,
                            COALESCE(r.product_reason_type, r.user_reason_type, 'other') as report_type,
                            r.created_at as activity_time,
                            CONCAT(r.report_type, ' report submitted') as activity_message
                        FROM reports r
                        INNER JOIN users u ON r.reporter_id = u.id
                        LEFT JOIN products p ON r.product_id = p.product_id
                        WHERE r.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                    )
                    ORDER BY activity_time DESC
                    LIMIT :limit";
            }
            
            $stmt = $this->pdo->prepare($sql);
            $stmt->bindValue(':limit', (int)$limit, \PDO::PARAM_INT);
            $stmt->execute();
            
            $activities = $stmt->fetchAll(\PDO::FETCH_ASSOC);
            
            return [
                "status" => "success",
                "code" => 200,
                "data" => $activities
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

    /**
     * Parse specifications JSON and convert to array format
     */
    private function parseSpecificationsJson($specificationsJson) {
        if (empty($specificationsJson)) {
            return [];
        }
        
        $specs = json_decode($specificationsJson, true);
        if (!is_array($specs)) {
            return [];
        }
        
        // Convert to the expected format with spec_name and spec_value
        $result = [];
        foreach ($specs as $spec) {
            if (is_array($spec) && isset($spec['name']) && isset($spec['value'])) {
                $result[] = [
                    'spec_name' => $spec['name'],
                    'spec_value' => $spec['value']
                ];
            }
        }
        
        return $result;
    }

    /**
     * Get product specifications by product ID (deprecated - now using JSON column)
     * Kept for backward compatibility
     */
    public function getProductSpecifications($product_id) {
        // First try to get from JSON column
        $sql = "SELECT specifications FROM products WHERE product_id = :product_id";
        $result = $this->executeQuery($sql, [':product_id' => $product_id]);
        
        if ($result['status'] === 'success' && !empty($result['data'])) {
            $specs = $this->parseSpecificationsJson($result['data'][0]['specifications'] ?? null);
            return $this->sendPayload($specs, "success", "Specifications retrieved successfully", 200);
        }
        
        return $this->sendPayload([], "success", "No specifications found", 200);
    }

    /**
     * Get user reports by reporter ID
     */
    public function getUserReports($user_id) {
        $sql = "SELECT r.*, 
                       reporter.full_name as reporter_name,
                       reporter.email as reporter_email,
                       reporter.profile_image as reporter_profile_image,
                       reported_user.full_name as reported_user_name,
                       reported_user.email as reported_user_email,
                       p.product_name,
                       p.price as product_price,
                       p.product_images,
                       p.description as product_description,
                       reviewer.username as reviewed_by_name
                FROM reports r 
                LEFT JOIN users reporter ON r.reporter_id = reporter.id
                LEFT JOIN users reported_user ON r.reported_user_id = reported_user.id
                LEFT JOIN products p ON r.product_id = p.product_id
                LEFT JOIN admins reviewer ON r.reviewed_by = reviewer.admin_id
                WHERE r.reporter_id = :user_id 
                ORDER BY r.created_at DESC";
        
        return $this->executeQuery($sql, [':user_id' => $user_id]);
    }

    /**
     * Get all user reports for admin monitoring (same as getAllReports for now)
     */
    public function getAllUserReports() {
        $sql = "SELECT r.*, 
                       reporter.full_name as reporter_name,
                       reporter.email as reporter_email,
                       reporter.profile_image as reporter_profile_image,
                       reported_user.full_name as reported_user_name,
                       reported_user.email as reported_user_email,
                       p.product_name,
                       p.price as product_price,
                       p.product_images,
                       p.description as product_description,
                       reviewer.username as reviewed_by_name
                FROM reports r 
                LEFT JOIN users reporter ON r.reporter_id = reporter.id
                LEFT JOIN users reported_user ON r.reported_user_id = reported_user.id
                LEFT JOIN products p ON r.product_id = p.product_id
                LEFT JOIN admins reviewer ON r.reviewed_by = reviewer.admin_id
                ORDER BY r.created_at DESC";
        
        return $this->executeQuery($sql);
    }

    /**
     * Get user notifications with product details
     */
    public function getUserNotifications($user_id) {
        $sql = "SELECT un.*, p.product_name, p.archive_reason
                FROM user_notifications un
                LEFT JOIN products p ON un.reference_id = p.product_id AND un.type = 'product_archived'
                WHERE un.user_id = :user_id
                ORDER BY un.created_at DESC";
        
        return $this->executeQuery($sql, [':user_id' => $user_id]);
    }

    /**
     * Get unread counts for messages and notifications
     */
    public function getUnreadCounts($user_id) {
        try {
            // Get unread messages count across all conversations
            $messagesSql = "SELECT COUNT(*) as count FROM messages m
                           INNER JOIN conversations c ON m.conversation_id = c.conversation_id
                           WHERE (c.buyer_id = :user_id1 OR c.seller_id = :user_id2)
                           AND m.sender_id != :user_id3
                           AND m.is_read = 0";
            
            $messagesStmt = $this->pdo->prepare($messagesSql);
            $messagesStmt->execute([
                ':user_id1' => $user_id,
                ':user_id2' => $user_id,
                ':user_id3' => $user_id
            ]);
            $unreadMessages = $messagesStmt->fetch(\PDO::FETCH_ASSOC)['count'] ?? 0;

            // Get unread notifications count
            $notificationsSql = "SELECT COUNT(*) as count FROM user_notifications
                                WHERE user_id = :user_id AND is_read = 0";
            
            $notificationsStmt = $this->pdo->prepare($notificationsSql);
            $notificationsStmt->execute([':user_id' => $user_id]);
            $unreadNotifications = $notificationsStmt->fetch(\PDO::FETCH_ASSOC)['count'] ?? 0;

            return [
                'status' => 'success',
                'code' => 200,
                'data' => [
                    'unread_messages' => (int)$unreadMessages,
                    'unread_notifications' => (int)$unreadNotifications
                ],
                'timestamp' => date('c')
            ];

        } catch (\PDOException $e) {
            return [
                'status' => 'error',
                'code' => 400,
                'message' => $e->getMessage(),
                'data' => []
            ];
        }
    }

}
