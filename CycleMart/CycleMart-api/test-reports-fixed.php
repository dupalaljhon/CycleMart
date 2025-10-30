<?php
// Test Reports Functions - Database Structure and getUserReports Fix
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");

require_once "./api/config/database.php";
require_once "./api/modules/post.php";

try {
    $con = new Connection();
    $pdo = $con->connect();
    $post = new Post($pdo);

    echo "=== Testing Reports Functions After Fix ===\n\n";

    // 1. Check database table structure
    echo "1. Checking Reports Table Structure:\n";
    $stmt = $pdo->query("DESCRIBE reports");
    $columns = $stmt->fetchAll(PDO::FETCH_ASSOC);
    foreach ($columns as $column) {
        echo "- {$column['Field']} ({$column['Type']}) - {$column['Key']}\n";
    }
    echo "\n";

    // 2. Check if there are any reports in the database
    echo "2. Checking Existing Reports:\n";
    $stmt = $pdo->query("SELECT COUNT(*) as total FROM reports");
    $count = $stmt->fetch(PDO::FETCH_ASSOC);
    echo "Total reports in database: {$count['total']}\n\n";

    // 3. Test getUserReports function with a valid user ID
    echo "3. Testing getUserReports Function:\n";
    // First check what user IDs exist
    $stmt = $pdo->query("SELECT DISTINCT reporter_id FROM reports LIMIT 5");
    $userIds = $stmt->fetchAll(PDO::FETCH_COLUMN);
    
    if (!empty($userIds)) {
        $testUserId = $userIds[0];
        echo "Testing with user ID: {$testUserId}\n";
        $result = $post->getUserReports($testUserId);
        echo json_encode($result, JSON_PRETTY_PRINT) . "\n\n";
    } else {
        echo "No reports found to test with.\n\n";
    }

    // 4. Test basic SQL query to ensure it works
    echo "4. Testing Direct SQL Query:\n";
    $sql = "SELECT r.report_id, r.reporter_id, r.reason_type, r.status, r.created_at FROM reports r LIMIT 3";
    $stmt = $pdo->query($sql);
    $directResults = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo "Direct query results:\n";
    echo json_encode($directResults, JSON_PRETTY_PRINT) . "\n\n";

    // 5. Check users table structure to understand available columns
    echo "5. Checking Users Table Structure:\n";
    $stmt = $pdo->query("DESCRIBE users");
    $userColumns = $stmt->fetchAll(PDO::FETCH_ASSOC);
    foreach ($userColumns as $column) {
        echo "- {$column['Field']} ({$column['Type']}) - {$column['Key']}\n";
    }

    echo "=== Tests Completed Successfully ===\n";

} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
    echo "File: " . $e->getFile() . "\n";
    echo "Line: " . $e->getLine() . "\n";
    echo "Stack trace: " . $e->getTraceAsString() . "\n";
}
?>