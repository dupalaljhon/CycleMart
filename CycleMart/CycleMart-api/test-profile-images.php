<?php
require_once './api/config/database.php';
require_once './api/modules/post.php';

$con = new Connection();
$pdo = $con->connect();
$post = new Post($pdo);

echo "Testing getAllReports for profile images...\n";

$data = $post->getAllReports();

if (isset($data['data']) && count($data['data']) > 0) {
    echo "Total reports: " . count($data['data']) . "\n";
    $firstReport = $data['data'][0];
    
    echo "\nFirst report data:\n";
    echo "Report ID: " . ($firstReport['report_id'] ?? 'NULL') . "\n";
    echo "Reporter ID: " . ($firstReport['reporter_id'] ?? 'NULL') . "\n";
    echo "Reporter Name: " . ($firstReport['reporter_name'] ?? 'NULL') . "\n";
    echo "Reporter Email: " . ($firstReport['reporter_email'] ?? 'NULL') . "\n";
    echo "Reporter Profile Image: " . ($firstReport['reporter_profile_image'] ?? 'NULL') . "\n";
    
    // Check if there are any users with profile images
    echo "\nChecking users table for profile images...\n";
    $sql = "SELECT id, full_name, email, profile_image FROM users LIMIT 5";
    $stmt = $pdo->prepare($sql);
    $stmt->execute();
    $users = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    foreach ($users as $user) {
        echo "User ID: " . $user['id'] . ", Name: " . $user['full_name'] . ", Profile Image: " . ($user['profile_image'] ?? 'NULL') . "\n";
    }
    
} else {
    echo "No reports found or error:\n";
    echo json_encode($data, JSON_PRETTY_PRINT) . "\n";
}
?>