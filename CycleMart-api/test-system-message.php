<?php
// Test file to debug system message API
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once 'api/config/database.php';
require_once 'api/modules/post.php';
require_once 'api/modules/global.php';

$database = new Database();
$db = $database->getConnection();

$post = new Post($db);

// Test data for system message
$testData = (object)[
    'conversation_id' => 1, // Change this to a real conversation ID
    'sender_id' => 0,       // System message
    'message_text' => "✅ This is a TEST system message.\n\n📦 Product: Test Product\n💰 Price: $100.00\n📊 Status: Sold\n\n👤 Buyer: Test Buyer\n\n⭐ You can now rate the seller.",
    'attachments' => []
];

echo "Testing System Message API...\n\n";
echo "Test Data:\n";
echo json_encode($testData, JSON_PRETTY_PRINT) . "\n\n";

echo "Sending message...\n";
$result = $post->sendMessage($testData);

echo "\nResult:\n";
echo json_encode($result, JSON_PRETTY_PRINT);
?>
