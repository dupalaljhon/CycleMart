<?php
// Debug the authorization issue
header("Content-Type: text/plain");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");

require_once './api/config/database.php';

$con = new Connection();
$pdo = $con->connect();

echo "🔍 DEBUGGING AUTHORIZATION ISSUE\n";
echo "================================\n\n";

// Get sample data to test with
$sampleData = $pdo->query("
    SELECT product_id, uploader_id, product_name 
    FROM products 
    WHERE product_id IN (59, 29, 60) 
    ORDER BY product_id
")->fetchAll(PDO::FETCH_ASSOC);

echo "📋 Sample Product Data:\n";
foreach ($sampleData as $product) {
    echo "  Product ID: {$product['product_id']} (type: " . gettype($product['product_id']) . ")\n";
    echo "  Uploader ID: {$product['uploader_id']} (type: " . gettype($product['uploader_id']) . ")\n";
    echo "  Product Name: {$product['product_name']}\n";
    echo "  ---\n";
}

// Test the exact authorization query
echo "\n🔍 Testing Authorization Query:\n\n";

$testCases = [
    ['product_id' => 59, 'uploader_id' => 1],
    ['product_id' => '59', 'uploader_id' => '1'],
    ['product_id' => 59, 'uploader_id' => '1'],
    ['product_id' => '59', 'uploader_id' => 1],
];

foreach ($testCases as $index => $testCase) {
    echo "Test Case " . ($index + 1) . ":\n";
    echo "  Product ID: {$testCase['product_id']} (type: " . gettype($testCase['product_id']) . ")\n";
    echo "  Uploader ID: {$testCase['uploader_id']} (type: " . gettype($testCase['uploader_id']) . ")\n";
    
    $sql = "SELECT COUNT(*) as count FROM products WHERE product_id = :product_id AND uploader_id = :uploader_id";
    
    try {
        $stmt = $pdo->prepare($sql);
        $stmt->execute([
            ':product_id' => $testCase['product_id'],
            ':uploader_id' => $testCase['uploader_id']
        ]);
        
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        $count = $result['count'];
        
        if ($count > 0) {
            echo "  ✅ MATCH FOUND: Authorization would succeed\n";
        } else {
            echo "  ❌ NO MATCH: Authorization would fail\n";
        }
        
    } catch (Exception $e) {
        echo "  ❌ QUERY ERROR: " . $e->getMessage() . "\n";
    }
    
    echo "\n";
}

// Test the exact update query that's failing
echo "🔍 Testing UPDATE Query (simulated):\n\n";

$updateSql = "SELECT COUNT(*) as count FROM products WHERE product_id = :product_id AND uploader_id = :uploader_id";

// Test with common scenarios
$scenarios = [
    ['name' => 'Integer IDs', 'product_id' => 59, 'uploader_id' => 1],
    ['name' => 'String IDs', 'product_id' => '59', 'uploader_id' => '1'],
    ['name' => 'Mixed Types 1', 'product_id' => 59, 'uploader_id' => '1'],
    ['name' => 'Mixed Types 2', 'product_id' => '59', 'uploader_id' => 1],
    ['name' => 'Float to Int', 'product_id' => 59.0, 'uploader_id' => 1.0],
];

foreach ($scenarios as $scenario) {
    echo "Scenario: {$scenario['name']}\n";
    echo "  Product ID: {$scenario['product_id']} (type: " . gettype($scenario['product_id']) . ")\n";
    echo "  Uploader ID: {$scenario['uploader_id']} (type: " . gettype($scenario['uploader_id']) . ")\n";
    
    try {
        $stmt = $pdo->prepare($updateSql);
        $stmt->execute([
            ':product_id' => $scenario['product_id'],
            ':uploader_id' => $scenario['uploader_id']
        ]);
        
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($result['count'] > 0) {
            echo "  ✅ UPDATE WOULD SUCCEED\n";
        } else {
            echo "  ❌ UPDATE WOULD FAIL - Product not found or unauthorized\n";
        }
        
    } catch (Exception $e) {
        echo "  ❌ QUERY ERROR: " . $e->getMessage() . "\n";
    }
    
    echo "\n";
}

// Check the actual data types in database
echo "🔍 Database Column Types:\n\n";
$tableInfo = $pdo->query("DESCRIBE products")->fetchAll(PDO::FETCH_ASSOC);

foreach ($tableInfo as $column) {
    if (in_array($column['Field'], ['product_id', 'uploader_id'])) {
        echo "  {$column['Field']}: {$column['Type']} (Null: {$column['Null']}, Key: {$column['Key']})\n";
    }
}

echo "\n🎯 POTENTIAL SOLUTIONS:\n";
echo "1. Ensure frontend sends integer values, not strings\n";
echo "2. Cast values to integers in PHP before query\n";
echo "3. Add debugging to see exact values being passed\n";
echo "4. Check if uploader_id is being set correctly in frontend\n";

echo "\n📋 Sample JSON for testing:\n";
echo json_encode([
    'product_id' => 59,
    'uploader_id' => 1,
    'product_name' => 'Test Product',
    'price' => 299.99,
    'description' => 'Test description',
    'location' => 'Test location',
    'specifications' => [
        ['spec_name' => 'Test Spec', 'spec_value' => 'Test Value']
    ]
], JSON_PRETTY_PRINT);
?>