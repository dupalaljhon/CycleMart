<?php
// Enable error reporting for debugging (remove in production)
error_reporting(E_ALL);
ini_set('display_errors', 1);
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/php_errors.log');

// Allow Angular dev server
header("Access-Control-Allow-Origin: *"); 
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Access-Control-Allow-Credentials: true");
header("Content-Type: application/json");

// ✅ Handle preflight OPTIONS requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

try {
    // Check if required files exist
    $requiredFiles = [
        "./modules/get.php",
        "./modules/post.php",
        "./modules/global.php",
        "./config/database.php"
    ];

    foreach ($requiredFiles as $file) {
        if (!file_exists($file)) {
            throw new Exception("Required file missing: " . $file);
        }
    }

    require_once "./modules/get.php";
    require_once "./modules/post.php";
    require_once "./modules/global.php";
    require_once "./config/database.php";

    $con = new Connection();
    $pdo = $con->connect();

    $get = new Get($pdo);
    $post = new Post($pdo);
    $global = new GlobalMethods();

    if (isset($_REQUEST['request'])) {
        $request = explode('/', $_REQUEST['request']);
    } else {
        echo json_encode(["status" => "error", "message" => "Not Found"]);
        http_response_code(404);
        exit();
    }

    switch ($_SERVER['REQUEST_METHOD']) {
        case 'GET':
            switch ($request[0]) {
                case 'health':
                    // Health check endpoint
                    echo json_encode([
                        "status" => "success",
                        "message" => "API is running",
                        "timestamp" => date('Y-m-d H:i:s'),
                        "php_version" => phpversion(),
                        "database" => "connected"
                    ]);
                    break;

                case 'user':
                    if (isset($_GET['id'])) {
                        echo json_encode($get->getUserById((int) $_GET['id']));
                    } else {
                        http_response_code(400);
                        echo json_encode([
                            "status" => "error",
                            "code" => 400,
                            "message" => "Missing ID",
                            "data" => []
                        ]);
                    }
                    break;

                case 'all-users':
                    echo json_encode($get->getAllUsers());
                    break;

                case 'products':
                    if (isset($_GET['uploader_id'])) {
                        echo json_encode($get->getProductsByUser((int)$_GET['uploader_id']));
                    } elseif (isset($_GET['product_id'])) {
                        echo json_encode($get->getProductById((int)$_GET['product_id']));
                    } else {
                        http_response_code(400);
                        echo json_encode([
                            "status" => "error",
                            "code" => 400,
                            "message" => "Missing uploader_id or product_id",
                            "data" => []
                        ]);
                    }
                    break;

                case 'all-products':
                    echo json_encode($get->getAllActiveProducts());
                    break;

                case 'admin-products':
                    echo json_encode($get->getAllProductsForAdmin());
                    break;

                case 'admin-notifications':
                    if (isset($_GET['admin_id'])) {
                        echo json_encode($post->getAdminNotifications((int) $_GET['admin_id']));
                    } else {
                        echo json_encode(["status" => "error", "message" => "Admin ID required"]);
                    }
                    break;

                case 'notification-counts':
                    if (isset($_GET['admin_id'])) {
                        echo json_encode($post->getNotificationCounts((int) $_GET['admin_id']));
                    } else {
                        echo json_encode(["status" => "error", "message" => "Admin ID required"]);
                    }
                    break;

                case 'dashboard-stats':
                    echo json_encode($get->getDashboardStats());
                    break;

                case 'chart-data':
                    echo json_encode($get->getChartData());
                    break;

                case 'all-admins':
                    echo json_encode($get->getAllAdmins());
                    break;

                case 'admin':
                    if (isset($_GET['id'])) {
                        echo json_encode($get->getAdminById((int) $_GET['id']));
                    } else {
                        http_response_code(400);
                        echo json_encode([
                            "status" => "error",
                            "code" => 400,
                            "message" => "Missing admin ID",
                            "data" => []
                        ]);
                    }
                    break;

                case 'conversations':
                    if (isset($_GET['user_id'])) {
                        echo json_encode($get->getUserConversations((int) $_GET['user_id']));
                    } else {
                        http_response_code(400);
                        echo json_encode([
                            "status" => "error",
                            "code" => 400,
                            "message" => "Missing user_id",
                            "data" => []
                        ]);
                    }
                    break;

                case 'archived-conversations':
                    if (isset($_GET['user_id'])) {
                        echo json_encode($get->getUserArchivedConversations((int) $_GET['user_id']));
                    } else {
                        http_response_code(400);
                        echo json_encode([
                            "status" => "error",
                            "code" => 400,
                            "message" => "Missing user_id",
                            "data" => []
                        ]);
                    }
                    break;

                case 'messages':
                    if (isset($_GET['conversation_id'])) {
                        echo json_encode($get->getConversationMessages((int) $_GET['conversation_id']));
                    } else {
                        http_response_code(400);
                        echo json_encode([
                            "status" => "error",
                            "code" => 400,
                            "message" => "Missing conversation_id",
                            "data" => []
                        ]);
                    }
                    break;

                case 'user-reports':
                    if (isset($_GET['user_id'])) {
                        echo json_encode($get->getUserReports((int) $_GET['user_id']));
                    } else {
                        http_response_code(400);
                        echo json_encode([
                            "status" => "error",
                            "code" => 400,
                            "message" => "Missing user_id",
                            "data" => []
                        ]);
                    }
                    break;

                case 'all-reports':
                    echo json_encode($post->getAllReports());
                    break;

                case 'all-user-reports':
                    echo json_encode($get->getAllUserReports());
                    break;

                case 'user-ratings':
                    if (isset($_GET['user_id'])) {
                        echo json_encode($get->getUserRatings((int) $_GET['user_id']));
                    } else {
                        http_response_code(400);
                        echo json_encode([
                            "status" => "error",
                            "code" => 400,
                            "message" => "Missing user_id",
                            "data" => []
                        ]);
                    }
                    break;

                case 'conversation-rating':
                    if (isset($_GET['conversation_id']) && isset($_GET['rated_by'])) {
                        echo json_encode($get->getConversationRating((int) $_GET['conversation_id'], (int) $_GET['rated_by']));
                    } else {
                        http_response_code(400);
                        echo json_encode([
                            "status" => "error",
                            "code" => 400,
                            "message" => "Missing conversation_id or rated_by",
                            "data" => []
                        ]);
                    }
                    break;

                case 'user-average-ratings':
                    if (isset($_GET['user_id'])) {
                        echo json_encode($get->getUserAverageRatings((int) $_GET['user_id']));
                    } else {
                        http_response_code(400);
                        echo json_encode([
                            "status" => "error",
                            "code" => 400,
                            "message" => "Missing user_id",
                            "data" => []
                        ]);
                    }
                    break;

                case 'sellers-with-ratings':
                    echo json_encode($get->getAllSellersWithRatings());
                    break;

                case 'product-specifications':
                    if (isset($_GET['product_id'])) {
                        echo json_encode($get->getProductSpecifications((int) $_GET['product_id']));
                    } else {
                        http_response_code(400);
                        echo json_encode(["status" => "error", "message" => "Product ID is required"]);
                    }
                    break;

                case 'user-notifications':
                    if (isset($_GET['user_id'])) {
                        echo json_encode($get->getUserNotifications((int) $_GET['user_id']));
                    } else {
                        http_response_code(400);
                        echo json_encode(["status" => "error", "message" => "User ID is required"]);
                    }
                    break;

                case 'unread-counts':
                    if (isset($_GET['user_id'])) {
                        echo json_encode($get->getUnreadCounts((int) $_GET['user_id']));
                    } else {
                        http_response_code(400);
                        echo json_encode(["status" => "error", "message" => "User ID is required"]);
                    }
                    break;

                case 'recent-activities':
                    $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 50;
                    $startDate = $_GET['start_date'] ?? null;
                    $endDate = $_GET['end_date'] ?? null;
                    echo json_encode($get->getRecentActivities($limit, $startDate, $endDate));
                    break;
                    
                default:
                    http_response_code(403);
                    echo json_encode(["status" => "error", "message" => "Forbidden"]);
                    break;
            }
            break;

        case 'POST':
            $rawInput = file_get_contents("php://input");
            $data = json_decode($rawInput);
            
            // Log for debugging
            error_log("POST Request - Endpoint: " . ($request[0] ?? 'unknown'));
            error_log("POST Request - Raw Input: " . substr($rawInput, 0, 500));
            
            if (json_last_error() !== JSON_ERROR_NONE) {
                throw new Exception("Invalid JSON: " . json_last_error_msg());
            }
            
            switch ($request[0]) {
                case 'register':
                    echo json_encode($post->registerUser($data));
                    break;

                case 'login':
                    echo json_encode($post->loginUser($data));
                    break;

                case 'verify-email':
                    echo json_encode($post->verifyEmail($data));
                    break;

                case 'resend-verification':
                    echo json_encode($post->resendVerificationEmail($data));
                    break;

                case 'admin':
                    if (isset($request[1]) && $request[1] === 'login') {
                        echo json_encode($post->adminLogin($data));
                    } elseif (isset($request[1]) && $request[1] === 'create') {
                        echo json_encode($post->createAdmin($data));
                    } elseif (isset($request[1]) && $request[1] === 'update') {
                        echo json_encode($post->updateAdmin($data));
                    } elseif (isset($request[1]) && $request[1] === 'delete') {
                        echo json_encode($post->deleteAdmin($data));
                    } else {
                        echo json_encode(["status" => "error", "message" => "Invalid admin endpoint"]);
                        http_response_code(400);
                    }
                    break;

                case 'upload':
                    echo json_encode($post->uploadProfile($data));
                    break;
                
                case 'editprofile':
                    echo json_encode($post->editProfile($data));
                    break;
                
                case 'addProduct':
                    if (isset($data->uploader_id)) {
                        $statusCheck = $global->checkAccountStatus($pdo, $data->uploader_id, 'addProduct');
                        if ($statusCheck !== null) {
                            echo json_encode($statusCheck);
                            break;
                        }
                    }
                    echo json_encode($post->addProduct($data));
                    break;

                case 'updateProduct':
                    echo json_encode($post->updateProduct($data));
                    break;

                case 'submitForApproval':
                    echo json_encode($post->submitForApproval($data));
                    break;

                case 'deleteProduct':
                    echo json_encode($post->deleteProduct($data));
                    break;

                case 'updateSaleStatus':
                    echo json_encode($post->updateSaleStatus($data));
                    break;

                case 'archiveProduct':
                    echo json_encode($post->archiveProduct($data));
                    break;

                case 'submit-user-report':
                    if (isset($data->reporter_id)) {
                        $statusCheck = $global->checkAccountStatus($pdo, $data->reporter_id, 'submit-user-report');
                        if ($statusCheck !== null) {
                            echo json_encode($statusCheck);
                            break;
                        }
                    }
                    echo json_encode($post->submitUserReport($data));
                    break;

                case 'update-user-report-status':
                    echo json_encode($post->updateUserReportStatus($data));
                    break;

                case 'markNotificationAsRead':
                    echo json_encode($post->markNotificationAsRead($data->notification_id, $data->admin_id));
                    break;

                case 'create-conversation':
                    echo json_encode($post->createConversation($data));
                    break;

                case 'send-message':
                    if (isset($data->sender_id)) {
                        $statusCheck = $global->checkAccountStatus($pdo, $data->sender_id, 'send-message');
                        if ($statusCheck !== null) {
                            echo json_encode($statusCheck);
                            break;
                        }
                    }
                    echo json_encode($post->sendMessage($data));
                    break;

                case 'mark-messages-read':
                    echo json_encode($post->markMessagesAsRead($data));
                    break;

                case 'submit-report':
                    if (isset($data->reporter_id)) {
                        $statusCheck = $global->checkAccountStatus($pdo, $data->reporter_id, 'submit-report');
                        if ($statusCheck !== null) {
                            echo json_encode($statusCheck);
                            break;
                        }
                    }
                    echo json_encode($post->submitReport($data));
                    break;

                case 'update-report-status':
                    echo json_encode($post->updateReportStatus($data));
                    break;

                case 'delete-user':
                    echo json_encode($post->deleteUser($data));
                    break;

                case 'submit-rating':
                    echo json_encode($post->submitRating($data));
                    break;

                case 'archive-conversation':
                    echo json_encode($post->archiveConversation($data));
                    break;

                case 'restore-conversation':
                    echo json_encode($post->restoreConversation($data));
                    break;

                case 'markUserNotificationAsRead':
                    echo json_encode($post->markUserNotificationAsRead($data));
                    break;

                case 'markAllUserNotificationsAsRead':
                    echo json_encode($post->markAllUserNotificationsAsRead($data));
                    break;

                case 'deleteUserNotification':
                    echo json_encode($post->deleteUserNotification($data));
                    break;

                case 'delete-conversation':
                    echo json_encode($post->deleteConversation($data));
                    break;

                case 'mark-user-violation':
                    echo json_encode($post->markUserViolation($data));
                    break;

                default:
                    echo json_encode(["status" => "error", "message" => "Forbidden"]);
                    http_response_code(403);
                    break;
            }
            break;

        default:
            http_response_code(405);
            echo json_encode([
                "status" => "error",
                "message" => "Method not allowed",
                "method" => $_SERVER['REQUEST_METHOD']
            ]);
            break;
    }

} catch (PDOException $e) {
    error_log("Database Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "status" => "error",
        "message" => "Database connection error",
        "error" => $e->getMessage(),
        "file" => $e->getFile(),
        "line" => $e->getLine()
    ]);
} catch (Exception $e) {
    error_log("General Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "status" => "error",
        "message" => "Internal server error",
        "error" => $e->getMessage(),
        "file" => $e->getFile(),
        "line" => $e->getLine()
    ]);
}
