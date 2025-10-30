<?php
// Allow Angular dev server
header("Access-Control-Allow-Origin: *"); 
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Access-Control-Allow-Credentials: true");

// ✅ Handle preflight OPTIONS requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}



require_once "./modules/get.php";
require_once "./modules/post.php";
require_once "./config/database.php";

$con = new Connection();
$pdo = $con->connect();

$get = new Get($pdo);
$post = new Post($pdo);

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
                echo json_encode($post->getUserReports((int) $_GET['user_id']));
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
            
        default:
            http_response_code(403);
            echo json_encode(["status" => "error", "message" => "Forbidden"]);
            break;
    }
    break;







    

    case 'POST':
        $data = json_decode(file_get_contents("php://input"));
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

            case 'markNotificationAsRead':
                echo json_encode($post->markNotificationAsRead($data->notification_id, $data->admin_id));
                break;

            case 'create-conversation':
                echo json_encode($post->createConversation($data));
                break;

            case 'send-message':
                echo json_encode($post->sendMessage($data));
                break;

            case 'mark-messages-read':
                echo json_encode($post->markMessagesAsRead($data));
                break;

            case 'submit-report':
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

            case 'delete-conversation':
                echo json_encode($post->deleteConversation($data));
                break;

            default:
                echo json_encode(["status" => "error", "message" => "Forbidden"]);
                http_response_code(403);
                break;
        }
        break;
}
