<?php
require_once './config/database.php';

try {
    $con = new Connection();
    $pdo = $con->connect();

    echo "=== Database Date Analysis ===\n\n";

    echo "1. Users Creation Dates:\n";
    $users = $pdo->query('SELECT id, full_name, created_at FROM users ORDER BY created_at DESC');
    foreach($users as $user) {
        echo "- {$user['full_name']}: {$user['created_at']}\n";
    }

    echo "\n2. Products Creation Dates:\n";
    $products = $pdo->query('SELECT product_id, product_name, created_at FROM products ORDER BY created_at DESC');
    foreach($products as $product) {
        echo "- {$product['product_name']}: {$product['created_at']}\n";
    }

    echo "\n3. Current Date: " . date('Y-m-d H:i:s') . "\n";
    echo "4. 12 Months Ago: " . date('Y-m-d H:i:s', strtotime('-12 months')) . "\n";

    echo "\n5. Reports Creation Dates:\n";
    $reports = $pdo->query('SELECT report_id, reason_type, created_at FROM reports ORDER BY created_at DESC');
    foreach($reports as $report) {
        echo "- {$report['reason_type']}: {$report['created_at']}\n";
    }

} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
?>