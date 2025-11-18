<?php
// Test Dashboard Data Endpoints
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");

require_once "./config/database.php";
require_once "./modules/get.php";

try {
    $con = new Connection();
    $pdo = $con->connect();
    $get = new Get($pdo);

    echo "=== Testing Dashboard Data Endpoints ===\n\n";

    // Test dashboard stats
    echo "1. Testing Dashboard Stats:\n";
    $stats = $get->getDashboardStats();
    echo json_encode($stats, JSON_PRETTY_PRINT) . "\n\n";

    // Test chart data
    echo "2. Testing Chart Data:\n";
    $chartData = $get->getChartData();
    echo json_encode($chartData, JSON_PRETTY_PRINT) . "\n\n";

    // Test admin notifications (using admin_id = 3 from the SQL dump)
    echo "3. Testing Admin Notifications:\n";
    $notifications = $get->getAdminNotifications(3);
    echo json_encode($notifications, JSON_PRETTY_PRINT) . "\n\n";

    // Test notification counts
    echo "4. Testing Notification Counts:\n";
    $counts = $get->getNotificationCounts(3);
    echo json_encode($counts, JSON_PRETTY_PRINT) . "\n\n";

    echo "=== All Tests Completed ===\n";

} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
    echo "Stack trace: " . $e->getTraceAsString() . "\n";
}
?>