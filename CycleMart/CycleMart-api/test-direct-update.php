<?php
// Test the updateProduct function directly
header("Content-Type: text/plain");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");

require_once './api/config/database.php';
require_once './api/modules/post.php';

$con = new Connection();
$pdo = $con->connect();
$post = new Post($pdo);

echo "🧪 TESTING updateProduct FUNCTION DIRECTLY\n";
echo "==========================================\n\n";

// Get current product data first
echo "1️⃣ Getting current product data...\n";
$currentProduct = $pdo->query("SELECT * FROM products WHERE product_id = 59")->fetch(PDO::FETCH_ASSOC);

if (!$currentProduct) {
    echo "❌ Product 59 not found!\n";
    exit;
}

echo "✅ Current product data:\n";
echo "   Product ID: {$currentProduct['product_id']}\n";
echo "   Product Name: {$currentProduct['product_name']}\n";
echo "   Uploader ID: {$currentProduct['uploader_id']}\n";
echo "   Price: {$currentProduct['price']}\n\n";

// Create test data object exactly as it would come from frontend
echo "2️⃣ Creating test update data...\n";

$testData = (object) [
    'product_id' => 59,
    'product_name' => $currentProduct['product_name'] . ' (DIRECT TEST)',
    'brand_name' => $currentProduct['brand_name'] ?? 'no brand',
    'custom_brand' => $currentProduct['custom_brand'] ?? '',
    'price' => floatval($currentProduct['price']),
    'description' => $currentProduct['description'] . ' - Updated via direct test',
    'location' => $currentProduct['location'],
    'for_type' => $currentProduct['for_type'],
    'condition' => $currentProduct['condition'],
    'category' => $currentProduct['category'],
    'quantity' => intval($currentProduct['quantity']),
    'product_images' => $currentProduct['product_images'] ?? '[]',
    'product_videos' => $currentProduct['product_videos'] ?? '[]',
    'specifications' => [
        (object) ['spec_name' => 'Direct Test Spec', 'spec_value' => 'Direct Test Value']
    ],
    'uploader_id' => intval($currentProduct['uploader_id'])
];

echo "✅ Test data created:\n";
echo "   Product ID: {$testData->product_id} (type: " . gettype($testData->product_id) . ")\n";
echo "   Uploader ID: {$testData->uploader_id} (type: " . gettype($testData->uploader_id) . ")\n";
echo "   Product Name: {$testData->product_name}\n\n";

// Test the function
echo "3️⃣ Calling updateProduct function...\n";

// Enable error logging to see our debug messages
ini_set('log_errors', 1);
ini_set('error_log', 'debug.log');

$result = $post->updateProduct($testData);

echo "✅ Function completed. Result:\n";
echo "Status: {$result['status']}\n";
echo "Message: {$result['message']}\n";
echo "Code: {$result['code']}\n";

if (isset($result['data'])) {
    echo "Data: " . json_encode($result['data'], JSON_PRETTY_PRINT) . "\n";
}

echo "\n4️⃣ Checking debug log...\n";

if (file_exists('debug.log')) {
    $debugLog = file_get_contents('debug.log');
    $debugLines = explode("\n", $debugLog);
    
    // Show only the recent debug lines
    $recentLines = array_slice($debugLines, -10);
    foreach ($recentLines as $line) {
        if (strpos($line, 'UpdateProduct Debug') !== false) {
            echo "DEBUG: $line\n";
        }
    }
} else {
    echo "⚠️ No debug log found\n";
}

echo "\n5️⃣ Verifying database state...\n";

$verifyProduct = $pdo->query("SELECT product_name FROM products WHERE product_id = 59")->fetch(PDO::FETCH_ASSOC);
echo "Current product name in DB: {$verifyProduct['product_name']}\n";

if (strpos($verifyProduct['product_name'], 'DIRECT TEST') !== false) {
    echo "✅ Product was actually updated in database!\n";
    echo "This means the function worked, but returned wrong status\n";
    
    // Restore original name
    $restoreSql = "UPDATE products SET product_name = ? WHERE product_id = 59";
    $restoreStmt = $pdo->prepare($restoreSql);
    $restoreStmt->execute([$currentProduct['product_name']]);
    echo "✅ Product name restored\n";
} else {
    echo "❌ Product was NOT updated in database\n";
    echo "This confirms the function actually failed\n";
}

echo "\n🎯 CONCLUSION:\n";
if ($result['status'] === 'success') {
    echo "✅ The updateProduct function works correctly!\n";
    echo "The issue must be in how it's being called from the API\n";
} else {
    echo "❌ The updateProduct function is failing\n";
    echo "Check the debug messages above for the exact cause\n";
}
?>