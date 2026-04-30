<?php
// CORS headers - must be first
header("Access-Control-Allow-Origin: *"); 
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Access-Control-Allow-Credentials: true");
header("Content-Type: application/json; charset=UTF-8");

// Handle preflight OPTIONS requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Enable error logging (can be disabled in production)
error_log("=== API Request ===");
error_log("Method: " . $_SERVER['REQUEST_METHOD']);
error_log("Request URI: " . $_SERVER['REQUEST_URI']);
error_log("Request: " . ($_REQUEST['request'] ?? 'NONE'));

try {
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
        echo json_encode(["status" => "error", "message" => "Not Found", "debug" => "No request parameter"]);
        http_response_code(404);
        exit();
    }

    error_log("Request endpoint: " . $request[0]);
} catch (Exception $e) {
    error_log("Fatal error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "status" => "error", 
        "message" => "Server initialization failed",
        "error" => $e->getMessage()
    ]);
    exit();
}

$jwtSecret = getenv('JWT_SECRET') ?: 'your_secret_key';

$extractBearerToken = function () {
    $authHeader = '';

    if (isset($_SERVER['HTTP_AUTHORIZATION'])) {
        $authHeader = $_SERVER['HTTP_AUTHORIZATION'];
    } elseif (isset($_SERVER['Authorization'])) {
        $authHeader = $_SERVER['Authorization'];
    } elseif (function_exists('apache_request_headers')) {
        $headers = apache_request_headers();
        if (isset($headers['Authorization'])) {
            $authHeader = $headers['Authorization'];
        } elseif (isset($headers['authorization'])) {
            $authHeader = $headers['authorization'];
        }
    }

    if ($authHeader && preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
        return trim($matches[1]);
    }

    return null;
};

$decodeJwt = function ($token) use ($jwtSecret) {
    return \Firebase\JWT\JWT::decode($token, new \Firebase\JWT\Key($jwtSecret, 'HS256'));
};

switch ($_SERVER['REQUEST_METHOD']) {
    case 'GET':
    switch ($request[0]) {
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

        case 'user-violation-details':
            if (isset($_GET['user_id'])) {
                echo json_encode($get->getUserViolationDetails((int) $_GET['user_id']));
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

        case 'purchased-products':
            if (isset($_GET['buyer_id'])) {
                echo json_encode($get->getProductsBoughtByUser((int)$_GET['buyer_id']));
            } else {
                http_response_code(400);
                echo json_encode([
                    "status" => "error",
                    "code" => 400,
                    "message" => "Missing buyer_id",
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

        case 'moderator-applications':
            // Get all moderator applications (with optional status filter)
            $status = $_GET['status'] ?? null;
            echo json_encode($get->getAllModeratorApplications($status));
            break;

        case 'moderator-application':
            // Get user's moderator application
            if (isset($_GET['user_id'])) {
                echo json_encode($get->getUserModeratorApplication((int) $_GET['user_id']));
            } elseif (isset($_GET['id'])) {
                echo json_encode($get->getModeratorApplicationById((int) $_GET['id']));
            } else {
                http_response_code(400);
                echo json_encode([
                    "status" => "error",
                    "code" => 400,
                    "message" => "Missing user_id or application id",
                    "data" => []
                ]);
            }
            break;

        case 'pending-moderator-applications-count':
            echo json_encode([
                'status' => 'success',
                'data' => ['count' => $get->getPendingModeratorApplicationsCount()]
            ]);
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

        case 'user-restriction':
            if (isset($_GET['user_id'])) {
                echo json_encode($post->checkUserRestriction((int) $_GET['user_id']));
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

        case 'product-specifications':
            // Note: Specifications are now included in product data as JSON
            // Use the regular products endpoint to get specifications
            if (isset($_GET['product_id'])) {
                echo json_encode($get->getProductSpecifications((int) $_GET['product_id']));
            } else {
                http_response_code(400);
                echo json_encode(["status" => "error", "message" => "Product ID is required"]);
            }
            break;

        case 'product-buyer':
            error_log("🔍 product-buyer route hit! product_id: " . ($_GET['product_id'] ?? 'NOT SET'));
            if (isset($_GET['product_id'])) {
                $result = $get->getProductBuyer((int)$_GET['product_id']);
                echo json_encode($result);
            } else {
                http_response_code(400);
                echo json_encode([
                    "status" => "error",
                    "code" => 400,
                    "message" => "Product ID is required",
                    "data" => null
                ]);
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

        case 'pending-products':
            echo json_encode($get->getPendingProducts());
            break;

        case 'listing-auto-approval-config':
            echo json_encode($get->getListingAutoApprovalConfig());
            break;

        case 'bicycle-brands':
            echo json_encode($get->getBicycleBrands());
            break;

        case 'bicycle-parts':
            if (isset($_GET['brand_id'])) {
                echo json_encode($get->getBicyclePartsByBrand((int) $_GET['brand_id']));
            } else {
                http_response_code(400);
                echo json_encode([
                    "status" => "error",
                    "code" => 400,
                    "message" => "Missing brand_id",
                    "data" => []
                ]);
            }
            break;

        case 'part-specifications':
            if (isset($_GET['part_id'])) {
                echo json_encode($get->getPartSpecifications((int) $_GET['part_id']));
            } else {
                http_response_code(400);
                echo json_encode([
                    "status" => "error",
                    "code" => 400,
                    "message" => "Missing part_id",
                    "data" => []
                ]);
            }
            break;

        case 'check-expired-reservations':
            // This allows checking expired reservations via GET (for page load trigger)
            echo json_encode($post->checkExpiredReservations());
            break;

        case 'landing-visit-counter':
            $action = $_GET['action'] ?? 'get';
            echo json_encode($get->getLandingVisitCounter($action));
            break;
            
        default:
            http_response_code(403);
            echo json_encode(["status" => "error", "message" => "Forbidden"]);
            break;
    }
    break;







    

    case 'POST':
        $rawInput = file_get_contents("php://input");
        error_log("POST Raw Input: " . substr($rawInput, 0, 200));
        
        $data = json_decode($rawInput);
        
        if (json_last_error() !== JSON_ERROR_NONE) {
            error_log("JSON decode error: " . json_last_error_msg());
            http_response_code(400);
            echo json_encode([
                "status" => "error", 
                "message" => "Invalid JSON",
                "error" => json_last_error_msg()
            ]);
            break;
        }
        
        error_log("POST Endpoint: " . ($request[0] ?? 'NONE'));

        $publicPostEndpoints = ['register', 'login', 'verify-email', 'resend-verification'];
        $isAdminLogin = (($request[0] ?? '') === 'admin' && (($request[1] ?? '') === 'login'));
        $isPublicPost = in_array(($request[0] ?? ''), $publicPostEndpoints, true) || $isAdminLogin;

        $jwtClaims = null;
        if (!$isPublicPost) {
            $token = $extractBearerToken();

            if (!$token) {
                http_response_code(401);
                echo json_encode([
                    "status" => "error",
                    "code" => 401,
                    "message" => "Missing JWT token"
                ]);
                break;
            }

            try {
                $jwtClaims = $decodeJwt($token);
            } catch (\Throwable $e) {
                http_response_code(401);
                echo json_encode([
                    "status" => "error",
                    "code" => 401,
                    "message" => "Invalid or expired JWT token"
                ]);
                break;
            }

            $jwtUid = isset($jwtClaims->uid) ? (int)$jwtClaims->uid : null;
            $userOwnedFieldByEndpoint = [
                'upload' => 'user_id',
                'editprofile' => 'user_id',
                'addProduct' => 'uploader_id',
                'updateProduct' => 'uploader_id',
                'deleteProduct' => 'uploader_id',
                'updateSaleStatus' => 'uploader_id',
                'submit-user-report' => 'reporter_id',
                'submit-report' => 'reporter_id',
                'send-message' => 'sender_id',
                'submit-rating' => 'rated_by'
            ];

            $currentEndpoint = $request[0] ?? '';
            if ($jwtUid && isset($userOwnedFieldByEndpoint[$currentEndpoint])) {
                $ownedField = $userOwnedFieldByEndpoint[$currentEndpoint];
                $requestValue = isset($data->$ownedField) ? (int)$data->$ownedField : null;
                
                // Debug logging for submit-rating
                if ($currentEndpoint === 'submit-rating') {
                    error_log("DEBUG submit-rating: JWT uid=" . $jwtUid . ", request " . $ownedField . "=" . $requestValue);
                }
                
                if (isset($data->$ownedField) && $requestValue !== $jwtUid) {
                    http_response_code(403);
                    echo json_encode([
                        "status" => "error",
                        "code" => 403,
                        "message" => "Token user does not match request owner"
                    ]);
                    break;
                }
            }

            $role = strtolower((string)($jwtClaims->role ?? ''));
            $isStaffToken = isset($jwtClaims->admin_id) || in_array($role, ['admin', 'moderator'], true);
            $isAdminEndpoint = (($request[0] ?? '') === 'admin' && in_array(($request[1] ?? ''), ['create', 'update', 'delete'], true));
            $staffOnlyEndpoints = [
                'approve-product',
                'reject-product',
                'listing-auto-approval-config',
                'mark-user-violation',
                'update-report-status',
                'update-user-report-status',
                'archiveProduct'
            ];

            if ($isAdminEndpoint || in_array($currentEndpoint, $staffOnlyEndpoints, true)) {
                if (!$isStaffToken) {
                    http_response_code(403);
                    echo json_encode([
                        "status" => "error",
                        "code" => 403,
                        "message" => "Insufficient permissions for this endpoint"
                    ]);
                    break;
                }
            }
        }
        
        // Debug logging for specific endpoints
        if (isset($request[0]) && in_array($request[0], ['login', 'register', 'updateProduct'])) {
            error_log("API Call - Endpoint: " . $request[0]);
            error_log("API Call - Data keys: " . implode(', ', array_keys((array)$data)));
        }
        
        switch ($request[0]) {
            case 'register':
                error_log("Calling registerUser");
                echo json_encode($post->registerUser($data));
                break;

            case 'login':
                error_log("Calling loginUser");
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

            case 'moderator-application':
                if (isset($request[1]) && $request[1] === 'submit') {
                    echo json_encode($post->submitModeratorApplication($data));
                } elseif (isset($request[1]) && $request[1] === 'review') {
                    echo json_encode($post->reviewModeratorApplication($data));
                } else {
                    echo json_encode(["status" => "error", "message" => "Invalid moderator application endpoint"]);
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
                // Check account status
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

            // Note: Individual specification endpoints removed
            // Specifications are now managed through updateProduct endpoint as JSON

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
                // Check account status
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
                // Check account status
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
                // Check account status
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
                // Check account status
                if (isset($data->rated_by)) {
                    $statusCheck = $global->checkAccountStatus($pdo, $data->rated_by, 'submit-rating');
                    if ($statusCheck !== null) {
                        echo json_encode($statusCheck);
                        break;
                    }
                }
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

            case 'approve-product':
                echo json_encode($post->approveProduct($data));
                break;

            case 'listing-auto-approval-config':
                echo json_encode($post->updateListingAutoApprovalConfig($data));
                break;

            case 'reject-product':
                echo json_encode($post->rejectProduct($data));
                break;

            // Reservation System Endpoints
            case 'reserve-product':
                echo json_encode($post->reserveProduct($data));
                break;

            case 'cancel-reservation':
                echo json_encode($post->cancelReservation($data));
                break;

            case 'check-expired-reservations':
                echo json_encode($post->checkExpiredReservations());
                break;

            case 'reservation-details':
                echo json_encode($post->getReservationDetails($data));
                break;

            case 'reservation-history':
                echo json_encode($post->getReservationHistory($data));
                break;

            default:
                error_log("POST endpoint not found: " . ($request[0] ?? 'NONE'));
                echo json_encode([
                    "status" => "error", 
                    "message" => "Endpoint not found",
                    "endpoint" => $request[0] ?? 'unknown',
                    "method" => "POST"
                ]);
                http_response_code(404);
                break;
        }
        break;

    default:
        error_log("Method not allowed: " . $_SERVER['REQUEST_METHOD']);
        http_response_code(405);
        echo json_encode([
            "status" => "error",
            "message" => "Method not allowed",
            "method" => $_SERVER['REQUEST_METHOD']
        ]);
        break;
}
