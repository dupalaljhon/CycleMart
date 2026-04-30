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
     * Ensure landing visit counter table and default row exist.
     */
    private function ensureLandingVisitCounterTable(): void {
        $createTableSql = "CREATE TABLE IF NOT EXISTS landing_page_visits (
            id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
            visit_count BIGINT UNSIGNED NOT NULL DEFAULT 0,
            last_visited_at TIMESTAMP NULL DEFAULT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";

        $this->pdo->exec($createTableSql);

        $seedSql = "INSERT INTO landing_page_visits (id, visit_count, last_visited_at)
                    VALUES (1, 0, NULL)
                    ON DUPLICATE KEY UPDATE id = id";
        $this->pdo->exec($seedSql);
    }

    /**
     * Get or increment landing page visit counter.
     */
    public function getLandingVisitCounter($action = 'get') {
        try {
            $this->ensureLandingVisitCounterTable();

            if ($action === 'increment') {
                $incrementSql = "UPDATE landing_page_visits
                                 SET visit_count = visit_count + 1,
                                     last_visited_at = CURRENT_TIMESTAMP
                                 WHERE id = 1";
                $incrementStmt = $this->pdo->prepare($incrementSql);
                $incrementStmt->execute();
            }

            $selectSql = "SELECT visit_count, last_visited_at FROM landing_page_visits WHERE id = 1";
            $selectStmt = $this->pdo->prepare($selectSql);
            $selectStmt->execute();
            $row = $selectStmt->fetch(\PDO::FETCH_ASSOC);

            if (!$row) {
                return $this->sendPayload(null, "error", "Unable to load visit counter", 500);
            }

            return $this->sendPayload([
                'visit_count' => (int) $row['visit_count'],
                'last_visited_at' => $row['last_visited_at']
            ], "success", "Landing page visit counter retrieved", 200);
        } catch (\PDOException $e) {
            return $this->sendPayload(null, "error", "Failed to handle landing visit counter: " . $e->getMessage(), 500);
        }
    }

    /**
     * Get user by ID (helper function for routes)
     */
    public function getUserById($id) {
        $sql = "SELECT id, full_name, email, phone, street, barangay, city, profile_image, terms_accepted, is_verified, account_status, violation_count, verification_token, token_expires_at, created_at, updated_at
                FROM users 
                WHERE id = :id";
        // Note: province field removed - restricted to Olongapo City only

        return $this->executeQuery($sql, [':id' => $id]);
    }

    /**
     * Get all users for admin management
     */
    public function getAllUsers() {
        $sql = "SELECT id, full_name, email, phone, street, barangay, city, profile_image, terms_accepted, is_verified, account_status, violation_count, verification_token, token_expires_at, created_at, updated_at
                FROM users 
                ORDER BY created_at DESC";
        // Note: province field removed - restricted to Olongapo City only

        return $this->executeQuery($sql);
    }

    /**
     * Get combined violation and report history for a specific user.
     */
    public function getUserViolationDetails($user_id) {
        if (!$user_id) {
            return $this->sendPayload(null, "error", "User ID is required", 400);
        }

        try {
            $userStmt = $this->pdo->prepare("SELECT id, full_name, email, account_status, violation_count FROM users WHERE id = :user_id");
            $userStmt->execute([':user_id' => $user_id]);
            $user = $userStmt->fetch(\PDO::FETCH_ASSOC);

            if (!$user) {
                return $this->sendPayload(null, "error", "User not found", 404);
            }

            $reportSql = "SELECT r.report_id, r.status, r.created_at, r.reason_details,
                                 COALESCE(r.user_reason_type, r.product_reason_type, 'others') AS reason_type,
                                 reporter.full_name AS reporter_name
                          FROM reports r
                          LEFT JOIN users reporter ON r.reporter_id = reporter.id
                          WHERE r.reported_user_id = :user_id
                          ORDER BY r.created_at DESC";
            $reportStmt = $this->pdo->prepare($reportSql);
            $reportStmt->execute([':user_id' => $user_id]);
            $reports = $reportStmt->fetchAll(\PDO::FETCH_ASSOC);

            $formattedReports = [];
            foreach ($reports as $report) {
                $reasonType = $report['reason_type'] ?? 'others';
                $formattedReports[] = [
                    'source' => 'report',
                    'id' => (int)$report['report_id'],
                    'title' => 'User Report Submitted',
                    'reason' => $report['reason_details'] ?: ucfirst(str_replace('_', ' ', $reasonType)),
                    'reason_type' => $reasonType,
                    'status' => $report['status'] ?? 'pending',
                    'reporter_name' => $report['reporter_name'] ?? 'Unknown reporter',
                    'created_at' => $report['created_at']
                ];
            }

            $notificationSql = "SELECT notification_id, title, message, created_at
                                FROM user_notifications
                                WHERE user_id = :user_id AND type = 'violation'
                                ORDER BY created_at DESC";
            $notificationStmt = $this->pdo->prepare($notificationSql);
            $notificationStmt->execute([':user_id' => $user_id]);
            $notifications = $notificationStmt->fetchAll(\PDO::FETCH_ASSOC);

            $formattedViolations = [];
            foreach ($notifications as $notification) {
                $reason = 'No specific reason provided';
                if (!empty($notification['message']) && preg_match('/Reason:\s*(.+?)(?:\\n|$)/is', $notification['message'], $matches)) {
                    $reason = trim($matches[1]);
                }

                $formattedViolations[] = [
                    'source' => 'admin_violation',
                    'id' => (int)$notification['notification_id'],
                    'title' => $notification['title'] ?: 'Account Violation Notice',
                    'reason' => $reason,
                    'status' => $user['account_status'] ?? 'active',
                    'created_at' => $notification['created_at']
                ];
            }

            $timeline = array_merge($formattedReports, $formattedViolations);
            usort($timeline, function ($a, $b) {
                return strtotime($b['created_at']) - strtotime($a['created_at']);
            });

            return $this->sendPayload([
                'user' => [
                    'id' => (int)$user['id'],
                    'full_name' => $user['full_name'],
                    'email' => $user['email'],
                    'account_status' => $user['account_status'] ?? 'active',
                    'violation_count' => (int)($user['violation_count'] ?? 0)
                ],
                'timeline' => $timeline,
                'reports' => $formattedReports,
                'violations' => $formattedViolations
            ], "success", "User violation details retrieved successfully", 200);
        } catch (\PDOException $e) {
            return $this->sendPayload(null, "error", "Failed to load user violation details: " . $e->getMessage(), 500);
        }
    }


    //get all products
    public function getProductsByUser($uploader_id) {
        $sql = "SELECT 
                p.*, 
                u.full_name as seller_name, 
                u.email as seller_email, 
                u.profile_image as seller_profile_image,
                bb.brand_name as bicycle_brand_name,
                bb.description as bicycle_brand_description,
                bp.part_name as bicycle_part_name,
                bp.category as bicycle_part_category,
                bp.description as bicycle_part_description
                FROM products p 
                JOIN users u ON p.uploader_id = u.id 
                LEFT JOIN bicycle_brands bb ON p.bicycle_brand_id = bb.brand_id
                LEFT JOIN bicycle_parts bp ON p.bicycle_part_id = bp.part_id
                WHERE p.uploader_id = :uploader_id AND (p.is_archived IS NULL OR p.is_archived = 0)
                ORDER BY p.created_at DESC";
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
        $sql = "SELECT 
                p.*, 
                u.full_name as seller_name, 
                u.email as seller_email, 
                u.profile_image as seller_profile_image,
                bb.brand_name as bicycle_brand_name,
                bb.description as bicycle_brand_description,
                bp.part_name as bicycle_part_name,
                bp.category as bicycle_part_category,
                bp.description as bicycle_part_description
                FROM products p 
                JOIN users u ON p.uploader_id = u.id 
                LEFT JOIN bicycle_brands bb ON p.bicycle_brand_id = bb.brand_id
                LEFT JOIN bicycle_parts bp ON p.bicycle_part_id = bp.part_id
                WHERE p.product_id = :product_id";
        $result = $this->executeQuery($sql, [':product_id' => $product_id]);
        
        // Parse specifications JSON for the product
        if ($result['status'] === 'success' && isset($result['data']) && !empty($result['data'])) {
            $result['data'][0]['specifications'] = $this->parseSpecificationsJson($result['data'][0]['specifications'] ?? null);
        }
        
        return $result;
    }

    /**
     * Get buyer information for a sold/traded product
     * Returns buyer details using the buyer_id stored when product was marked as sold
     */
    public function getProductBuyer($product_id) {
        try {
            error_log("🔍 getProductBuyer called for product_id: " . $product_id);
            
            // Get product info including buyer_id
            $checkSql = "SELECT product_id, sale_status, uploader_id, buyer_id, sale_conversation_id, transaction_date 
                        FROM products 
                        WHERE product_id = :product_id 
                        AND (sale_status = 'sold' OR sale_status = 'traded')";
            
            $stmt = $this->pdo->prepare($checkSql);
            $stmt->execute([':product_id' => $product_id]);
            $product = $stmt->fetch(\PDO::FETCH_ASSOC);
            
            if (!$product) {
                error_log("❌ Product not found or not sold/traded. Product ID: " . $product_id);
                return [
                    'status' => 'error',
                    'code' => 404,
                    'message' => 'Product not found or not sold/traded',
                    'data' => null
                ];
            }
            
            error_log("✅ Product found - ID: {$product['product_id']}, Status: {$product['sale_status']}, Buyer ID: " . ($product['buyer_id'] ?? 'NULL'));
            
            // Get buyer information directly using buyer_id
            if (!empty($product['buyer_id'])) {
                error_log("✅ Using stored buyer_id: " . $product['buyer_id']);
                $sql = "SELECT 
                            u.id as buyer_user_id,
                            u.full_name as buyer_name,
                            u.email as buyer_email,
                            u.phone as buyer_phone,
                            u.profile_image as buyer_profile_image,
                            u.street as buyer_street,
                            u.barangay as buyer_barangay,
                            u.city as buyer_city,
                            p.product_id,
                            p.product_name,
                            p.price,
                            p.sale_status,
                            p.transaction_date
                        FROM users u
                        CROSS JOIN products p
                        WHERE u.id = :buyer_id 
                        AND p.product_id = :product_id";
                
                $stmt = $this->pdo->prepare($sql);
                $stmt->execute([
                    ':buyer_id' => $product['buyer_id'],
                    ':product_id' => $product_id
                ]);
            } else {
                // Fallback: try to get buyer from conversation (for old records)
                error_log("⚠️ No buyer_id stored, using fallback query via conversation");
                $sql = "SELECT 
                            c.conversation_id,
                            c.buyer_id,
                            c.seller_id,
                            u.id as buyer_user_id,
                            u.full_name as buyer_name,
                            u.email as buyer_email,
                            u.phone as buyer_phone,
                            u.profile_image as buyer_profile_image,
                            u.street as buyer_street,
                            u.barangay as buyer_barangay,
                            u.city as buyer_city,
                            p.product_id,
                            p.product_name,
                            p.price,
                            p.sale_status,
                            p.transaction_date
                        FROM conversations c
                        INNER JOIN users u ON c.buyer_id = u.id
                        INNER JOIN products p ON c.product_id = p.product_id
                        WHERE c.product_id = :product_id 
                        AND c.seller_id = :seller_id
                        ORDER BY c.created_at DESC
                        LIMIT 1";
                
                $stmt = $this->pdo->prepare($sql);
                $stmt->execute([
                    ':product_id' => $product_id,
                    ':seller_id' => $product['uploader_id']
                ]);
            }
            
            error_log("🔍 Query executed for product_id: {$product_id}");
            
            $buyerData = $stmt->fetch(\PDO::FETCH_ASSOC);
            
            if ($buyerData) {
                // Normalize keys to lowercase
                $buyerData = array_change_key_case($buyerData, CASE_LOWER);
                error_log("✅ Buyer data found: " . json_encode($buyerData));
                
                return [
                    'status' => 'success',
                    'code' => 200,
                    'message' => 'Buyer information retrieved successfully',
                    'data' => $buyerData
                ];
            } else {
                error_log("❌ No buyer information found for product_id: {$product_id}");
                return [
                    'status' => 'error',
                    'code' => 404,
                    'message' => 'No buyer information found for this product',
                    'data' => null
                ];
            }
            
        } catch (\PDOException $e) {
            error_log("❌ PDO Exception in getProductBuyer: " . $e->getMessage());
            return [
                'status' => 'error',
                'code' => 500,
                'message' => $e->getMessage(),
                'data' => null
            ];
        }
    }

    // Get all active products for home page
    public function getAllActiveProducts() {
        $sql = "SELECT 
                p.*, 
                u.full_name as seller_name, 
                u.email as seller_email, 
                u.profile_image as seller_profile_image,
                bb.brand_name as bicycle_brand_name,
                bb.description as bicycle_brand_description,
                bp.part_name as bicycle_part_name,
                bp.category as bicycle_part_category,
                bp.description as bicycle_part_description
                FROM products p 
                JOIN users u ON p.uploader_id = u.id 
                LEFT JOIN bicycle_brands bb ON p.bicycle_brand_id = bb.brand_id
                LEFT JOIN bicycle_parts bp ON p.bicycle_part_id = bp.part_id
                WHERE p.status = 'active' AND p.sale_status = 'available' AND p.approval_status = 'approved' AND (p.is_archived IS NULL OR p.is_archived = 0)
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
        $sql = "SELECT 
                p.*, 
                u.full_name as seller_name, 
                u.email as seller_email, 
                u.profile_image as seller_profile_image,
                bb.brand_name as bicycle_brand_name,
                bb.description as bicycle_brand_description,
                bp.part_name as bicycle_part_name,
                bp.category as bicycle_part_category,
                bp.description as bicycle_part_description
                FROM products p 
                JOIN users u ON p.uploader_id = u.id 
                LEFT JOIN bicycle_brands bb ON p.bicycle_brand_id = bb.brand_id
                LEFT JOIN bicycle_parts bp ON p.bicycle_part_id = bp.part_id
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

    // Get all sold/traded products bought by a specific user
    public function getProductsBoughtByUser($buyer_id) {
        if (!$buyer_id) {
            return $this->sendPayload(null, "error", "Buyer ID is required", 400);
        }

        $sql = "SELECT 
                p.*, 
                seller.full_name as seller_name,
                seller.email as seller_email,
            seller.phone as seller_phone,
                seller.profile_image as seller_profile_image,
            seller.street as seller_street,
            seller.barangay as seller_barangay,
            seller.city as seller_city,
                buyer.full_name as buyer_name,
                buyer.email as buyer_email,
                buyer.phone as buyer_phone,
                buyer.profile_image as buyer_profile_image,
                buyer.street as buyer_street,
                buyer.barangay as buyer_barangay,
                buyer.city as buyer_city,
                bb.brand_name as bicycle_brand_name,
                bb.description as bicycle_brand_description,
                bp.part_name as bicycle_part_name,
                bp.category as bicycle_part_category,
                bp.description as bicycle_part_description
                FROM products p 
                JOIN users seller ON p.uploader_id = seller.id 
                LEFT JOIN users buyer ON buyer.id = p.buyer_id
                LEFT JOIN bicycle_brands bb ON p.bicycle_brand_id = bb.brand_id
                LEFT JOIN bicycle_parts bp ON p.bicycle_part_id = bp.part_id
                WHERE p.sale_status IN ('sold', 'traded')
                  AND (
                        p.buyer_id = :buyer_id_direct
                        OR p.sale_conversation_id IN (
                            SELECT c1.conversation_id
                            FROM conversations c1
                            WHERE c1.buyer_id = :buyer_id_sale_conversation
                        )
                        OR (
                            p.buyer_id IS NULL
                            AND EXISTS (
                                SELECT 1
                                FROM conversations c2
                                WHERE c2.product_id = p.product_id
                                  AND c2.buyer_id = :buyer_id_conversation
                                  AND c2.seller_id = p.uploader_id
                                  AND (
                                        p.sale_conversation_id IS NULL
                                        OR c2.conversation_id = p.sale_conversation_id
                                  )
                                  AND EXISTS (
                                      SELECT 1
                                      FROM messages m
                                      WHERE m.conversation_id = c2.conversation_id
                                        AND m.sender_id = 0
                                        AND (
                                            LOWER(m.message_text) LIKE '%already sold to you%'
                                            OR LOWER(m.message_text) LIKE '%already traded to you%'
                                        )
                                  )
                            )
                        )
                  )
                ORDER BY COALESCE(p.transaction_date, p.created_at) DESC";

        $result = $this->executeQuery($sql, [
            ':buyer_id_direct' => $buyer_id,
            ':buyer_id_sale_conversation' => $buyer_id,
            ':buyer_id_conversation' => $buyer_id
        ]);

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
                                // $attachment['url'] = 'http://api.cyclemart.shop/CycleMart-api/api' . $attachment['path'];
                                $attachment['url'] = 'http://localhost/CycleMart/CycleMart/CycleMart-api/api/' . ltrim($attachment['path'], '/');
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
    public function getRecentActivities($limit = 50, $startDate = null, $endDate = null) {
        try {
            $limit = (int)$limit;
            if ($limit < 1) {
                $limit = 50;
            }

            // Default to the most recent 30-day window when no range is provided.
            $defaultEnd = date('Y-m-d');
            $defaultStart = date('Y-m-d', strtotime('-29 days'));

            $rangeStart = $startDate ?: $defaultStart;
            $rangeEnd = $endDate ?: $defaultEnd;

            $isValidDate = function ($value) {
                $date = \DateTime::createFromFormat('Y-m-d', (string)$value);
                return $date && $date->format('Y-m-d') === $value;
            };

            if (!$isValidDate($rangeStart) || !$isValidDate($rangeEnd)) {
                return [
                    "status" => "error",
                    "code" => 400,
                    "message" => "Invalid date format. Use YYYY-MM-DD for start_date and end_date.",
                    "data" => []
                ];
            }

            if ($rangeStart > $rangeEnd) {
                return [
                    "status" => "error",
                    "code" => 400,
                    "message" => "start_date must be before or equal to end_date.",
                    "data" => []
                ];
            }

            // Check if user_reports table exists
            $userReportsExists = false;
            try {
                $this->pdo->query("SELECT 1 FROM user_reports LIMIT 1");
                $userReportsExists = true;
            } catch (\PDOException $e) {
                $userReportsExists = false;
            }
            
            // Build query based on table existence
            $queryParams = [];
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
                                                WHERE u.created_at >= ?
                                                    AND u.created_at < DATE_ADD(?, INTERVAL 1 DAY)
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
                                                WHERE p.created_at >= ?
                                                    AND p.created_at < DATE_ADD(?, INTERVAL 1 DAY)
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
                                                WHERE r.created_at >= ?
                                                    AND r.created_at < DATE_ADD(?, INTERVAL 1 DAY)
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
                                                WHERE ur.created_at >= ?
                                                    AND ur.created_at < DATE_ADD(?, INTERVAL 1 DAY)
                    )
                    ORDER BY activity_time DESC
                                        LIMIT {$limit}";

                                $queryParams = [
                                        $rangeStart,
                                        $rangeEnd,
                                        $rangeStart,
                                        $rangeEnd,
                                        $rangeStart,
                                        $rangeEnd,
                                        $rangeStart,
                                        $rangeEnd
                                ];
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
                                                WHERE u.created_at >= ?
                                                    AND u.created_at < DATE_ADD(?, INTERVAL 1 DAY)
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
                                                WHERE p.created_at >= ?
                                                    AND p.created_at < DATE_ADD(?, INTERVAL 1 DAY)
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
                                                WHERE r.created_at >= ?
                                                    AND r.created_at < DATE_ADD(?, INTERVAL 1 DAY)
                    )
                    ORDER BY activity_time DESC
                                        LIMIT {$limit}";

                                $queryParams = [
                                        $rangeStart,
                                        $rangeEnd,
                                        $rangeStart,
                                        $rangeEnd,
                                        $rangeStart,
                                        $rangeEnd
                                ];
            }
            
            $stmt = $this->pdo->prepare($sql);
                        $stmt->execute($queryParams);
            
            $activities = $stmt->fetchAll(\PDO::FETCH_ASSOC);
            
            return [
                "status" => "success",
                "code" => 200,
                "data" => $activities,
                "meta" => [
                    "start_date" => $rangeStart,
                    "end_date" => $rangeEnd,
                    "limit" => $limit
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
                  COALESCE(reported_user.full_name, product_owner.full_name) as reported_user_name,
                  COALESCE(reported_user.email, product_owner.email) as reported_user_email,
                  COALESCE(reported_user.profile_image, product_owner.profile_image) as reported_user_profile_image,
                       p.product_name,
                       p.price as product_price,
                       p.product_images,
                       p.description as product_description,
                       reviewer.username as reviewed_by_name
                FROM reports r 
                LEFT JOIN users reporter ON r.reporter_id = reporter.id
                LEFT JOIN users reported_user ON r.reported_user_id = reported_user.id
                LEFT JOIN products p ON r.product_id = p.product_id
              LEFT JOIN users product_owner ON p.uploader_id = product_owner.id
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
                  COALESCE(reported_user.full_name, product_owner.full_name) as reported_user_name,
                  COALESCE(reported_user.email, product_owner.email) as reported_user_email,
                  COALESCE(reported_user.profile_image, product_owner.profile_image) as reported_user_profile_image,
                       p.product_name,
                       p.price as product_price,
                       p.product_images,
                       p.description as product_description,
                       reviewer.username as reviewed_by_name
                FROM reports r 
                LEFT JOIN users reporter ON r.reporter_id = reporter.id
                LEFT JOIN users reported_user ON r.reported_user_id = reported_user.id
                LEFT JOIN products p ON r.product_id = p.product_id
              LEFT JOIN users product_owner ON p.uploader_id = product_owner.id
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

    /**
     * Get pending products for approval
     */
    public function getPendingProducts() {
        $sql = "SELECT 
                p.product_id, p.product_name, p.brand_name, p.custom_brand, 
                p.product_images, p.product_videos, 
                p.price, p.description, p.location, p.for_type, p.condition, 
                p.category, p.quantity, p.specifications, p.created_at, p.approval_status,
                p.bicycle_brand_id, p.bicycle_part_id,
                bb.brand_name as bicycle_brand_name,
                bb.description as bicycle_brand_description,
                bp.part_name as bicycle_part_name,
                bp.category as bicycle_part_category,
                bp.description as bicycle_part_description,
                u.full_name as seller_name, 
                u.email as seller_email, 
                u.profile_image as seller_profile_image 
                FROM products p 
                JOIN users u ON p.uploader_id = u.id 
                LEFT JOIN bicycle_brands bb ON p.bicycle_brand_id = bb.brand_id
                LEFT JOIN bicycle_parts bp ON p.bicycle_part_id = bp.part_id
                WHERE p.approval_status = 'pending'
                ORDER BY p.created_at ASC";
        $result = $this->executeQuery($sql);
        
        // Parse specifications JSON for each product
        if ($result['status'] === 'success' && isset($result['data'])) {
            foreach ($result['data'] as &$product) {
                $product['specifications'] = $this->parseSpecificationsJson($product['specifications'] ?? null);
                // Ensure product_videos is never null
                if (!isset($product['product_videos']) || $product['product_videos'] === null) {
                    $product['product_videos'] = '[]';
                }
            }
        }
        
        return $result;
    }

    /**
     * Get all active bicycle brands for dropdown
     * 
     * @return array
     */
    public function getBicycleBrands() {
        $sql = "SELECT brand_id, brand_name, description, logo_url 
                FROM bicycle_brands 
                WHERE is_active = TRUE 
                ORDER BY brand_name";
        
        return $this->executeQuery($sql);
    }

    /**
     * Get bicycle parts filtered by brand
     * 
     * @param int $brand_id - Brand ID to filter by (optional, pass NULL for universal parts)
     * @return array
     */
    public function getBicyclePartsByBrand($brand_id = null) {
        if ($brand_id === null) {
            // Get universal parts (brand_id is NULL)
            $sql = "SELECT part_id, part_name, category, description 
                    FROM bicycle_parts 
                    WHERE brand_id IS NULL AND is_active = TRUE 
                    ORDER BY category, part_name";
            return $this->executeQuery($sql);
        } else {
                        $isSpecialBrand = ((int)$brand_id === 16 || (int)$brand_id === 24) ? 1 : 0;

                        // Get brand-specific parts and universal parts.
                        // Universal cockpit parts are shown only when the selected brand has an active cockpit offering,
                        // except for special brands (Others/No Brand) which always see cockpit options.
                        $sql = "SELECT part_id, part_name, category, description 
                    FROM bicycle_parts 
                                        WHERE is_active = TRUE
                                            AND (
                                                brand_id = :brand_id
                                                OR (
                                                    brand_id IS NULL
                                                    AND LOWER(category) <> 'cockpit'
                                                )
                                                OR (
                                                    brand_id IS NULL
                                                    AND LOWER(category) = 'cockpit'
                                                    AND (
                                                        :is_special_brand = 1
                                                        OR EXISTS (
                                                            SELECT 1
                                                            FROM bicycle_parts bp2
                                                            WHERE bp2.brand_id = :brand_id_exists
                                                                AND bp2.is_active = TRUE
                                                                AND LOWER(bp2.category) = 'cockpit'
                                                        )
                                                    )
                                                )
                                            )
                    ORDER BY category, part_name";
                        return $this->executeQuery($sql, [
                                ':brand_id' => $brand_id,
                                ':brand_id_exists' => $brand_id,
                                ':is_special_brand' => $isSpecialBrand
                        ]);
        }
    }

    /**
     * Get part specifications (max 5 shown, ordered by display_order)
     * 
     * @param int $part_id - Part ID to get specifications for
     * @return array
     */
    public function getPartSpecifications($part_id) {
        $sql = "SELECT spec_id, spec_name, spec_label, spec_type, spec_options,
                       is_required, placeholder, display_order
                FROM part_specifications
                WHERE part_id = :part_id AND is_active = TRUE
                ORDER BY display_order, spec_id";

        try {
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([':part_id' => $part_id]);
            $rows = $stmt->fetchAll(\PDO::FETCH_ASSOC);

            if (!$rows || count($rows) === 0) {
                return $this->sendPayload(null, "error", "No records found", 404);
            }

            $uniqueBySpecName = [];
            foreach ($rows as $row) {
                $specNameKey = strtolower(trim((string)($row['spec_name'] ?? '')));
                if ($specNameKey === '' || isset($uniqueBySpecName[$specNameKey])) {
                    continue;
                }

                $uniqueBySpecName[$specNameKey] = $row;
            }

            $deduplicated = array_slice(array_values($uniqueBySpecName), 0, 5);

            if (count($deduplicated) === 0) {
                return $this->sendPayload(null, "error", "No records found", 404);
            }

            return $this->sendPayload($deduplicated, "success", "", 200);
        } catch (\PDOException $e) {
            return $this->sendPayload(null, "error", $e->getMessage(), 500);
        }
    }

    /**
     * Get listing auto-approval configuration.
     *
     * @return array
     */
    public function getListingAutoApprovalConfig() {
        try {
            $this->pdo->exec("CREATE TABLE IF NOT EXISTS listing_auto_approval_config (
                config_id INT PRIMARY KEY DEFAULT 1,
                is_enabled TINYINT(1) NOT NULL DEFAULT 0,
                updated_by INT NULL,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT chk_single_config CHECK (config_id = 1)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

            $this->pdo->exec("INSERT IGNORE INTO listing_auto_approval_config (config_id, is_enabled) VALUES (1, 0)");

            $stmt = $this->pdo->prepare("SELECT is_enabled, updated_by, updated_at FROM listing_auto_approval_config WHERE config_id = 1 LIMIT 1");
            $stmt->execute();
            $config = $stmt->fetch(\PDO::FETCH_ASSOC);

            if (!$config) {
                return $this->sendPayload([
                    'enabled' => false,
                    'updated_by' => null,
                    'updated_at' => null
                ], 'success', 'Listing auto-approval config fetched', 200);
            }

            return $this->sendPayload([
                'enabled' => ((int)$config['is_enabled'] === 1),
                'updated_by' => $config['updated_by'] ? (int)$config['updated_by'] : null,
                'updated_at' => $config['updated_at']
            ], 'success', 'Listing auto-approval config fetched', 200);
        } catch (\PDOException $e) {
            return $this->sendPayload(null, 'error', $e->getMessage(), 500);
        }
    }

    /**
     * Get all moderator applications (Admin view)
     * 
     * @param string|null $status - Filter by status (pending, approved, rejected) or null for all
     * @return array
     */
    public function getAllModeratorApplications($status = null) {
        $sql = "SELECT 
                    ma.application_id,
                    ma.user_id,
                    ma.full_name,
                    ma.reason,
                    ma.experience,
                    ma.status,
                    ma.created_at,
                    ma.updated_at,
                    ma.reviewed_at,
                    ma.reviewed_by,
                    ma.admin_account_id,
                    u.email,
                    u.profile_image,
                    a.username as reviewer_username
                FROM moderator_applications ma
                LEFT JOIN users u ON ma.user_id = u.id
                LEFT JOIN admins a ON ma.reviewed_by = a.admin_id";

        $params = [];
        
        if ($status !== null) {
            $sql .= " WHERE ma.status = :status";
            $params[':status'] = $status;
        }

        $sql .= " ORDER BY 
                    CASE ma.status 
                        WHEN 'pending' THEN 1 
                        WHEN 'approved' THEN 2 
                        WHEN 'rejected' THEN 3 
                    END,
                    ma.created_at DESC";

        return $this->executeQuery($sql, $params);
    }

    /**
     * Get moderator application by user ID
     * 
     * @param int $user_id
     * @return array
     */
    public function getUserModeratorApplication($user_id) {
        $sql = "SELECT 
                    ma.application_id,
                    ma.user_id,
                    ma.full_name,
                    ma.reason,
                    ma.experience,
                    ma.status,
                    ma.created_at,
                    ma.updated_at,
                    ma.reviewed_at,
                    ma.reviewed_by,
                    ma.admin_account_id,
                    a.username as reviewer_username
                FROM moderator_applications ma
                LEFT JOIN admins a ON ma.reviewed_by = a.admin_id
                WHERE ma.user_id = :user_id
                ORDER BY ma.created_at DESC
                LIMIT 1";

        return $this->executeQuery($sql, [':user_id' => $user_id]);
    }

    /**
     * Get moderator application by ID
     * 
     * @param int $application_id
     * @return array
     */
    public function getModeratorApplicationById($application_id) {
        $sql = "SELECT 
                    ma.application_id,
                    ma.user_id,
                    ma.full_name,
                    ma.reason,
                    ma.experience,
                    ma.status,
                    ma.created_at,
                    ma.updated_at,
                    ma.reviewed_at,
                    ma.reviewed_by,
                    ma.admin_account_id,
                    u.email,
                    u.profile_image,
                    u.role as current_role,
                    a.username as reviewer_username
                FROM moderator_applications ma
                LEFT JOIN users u ON ma.user_id = u.id
                LEFT JOIN admins a ON ma.reviewed_by = a.admin_id
                WHERE ma.application_id = :application_id";

        $result = $this->executeQuery($sql, [':application_id' => $application_id]);
        return $result[0] ?? null;
    }

    /**
     * Get pending moderator applications count
     * 
     * @return int
     */
    public function getPendingModeratorApplicationsCount() {
        $sql = "SELECT COUNT(*) as count 
                FROM moderator_applications 
                WHERE status = 'pending'";

        $result = $this->executeQuery($sql);
        return $result[0]['count'] ?? 0;
    }

}
