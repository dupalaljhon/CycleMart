<?php
// Debug data type mismatch in authorization
header("Content-Type: text/plain");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");

require_once './api/config/database.php';

$con = new Connection();
$pdo = $con->connect();

echo "🔍 DEBUGGING DATA TYPE MISMATCH\n";
echo "===============================\n\n";

// Test with the exact scenario from the error message
$product_id = 59;  // Known product ID
$uploader_id = 28; // User ID from error message

echo "📋 Testing with exact values from error:\n";
echo "Product ID: $product_id (type: " . gettype($product_id) . ")\n";
echo "Uploader ID: $uploader_id (type: " . gettype($uploader_id) . ")\n\n";

// Check what's actually in the database
echo "🔍 Database Values:\n";
$checkSql = "SELECT product_id, uploader_id FROM products WHERE product_id = $product_id";
$result = $pdo->query($checkSql)->fetch(PDO::FETCH_ASSOC);

if ($result) {
    echo "Database Product ID: {$result['product_id']} (type: " . gettype($result['product_id']) . ")\n";
    echo "Database Uploader ID: {$result['uploader_id']} (type: " . gettype($result['uploader_id']) . ")\n";
    
    // Test exact comparison
    echo "\n🔍 Comparison Tests:\n";
    echo "product_id == database_product_id: " . ($product_id == $result['product_id'] ? "TRUE" : "FALSE") . "\n";
    echo "product_id === database_product_id: " . ($product_id === $result['product_id'] ? "TRUE" : "FALSE") . "\n";
    echo "uploader_id == database_uploader_id: " . ($uploader_id == $result['uploader_id'] ? "TRUE" : "FALSE") . "\n";
    echo "uploader_id === database_uploader_id: " . ($uploader_id === $result['uploader_id'] ? "TRUE" : "FALSE") . "\n";
} else {
    echo "❌ Product not found in database!\n";
}

echo "\n🔍 Testing Different Data Type Scenarios:\n\n";

$testCases = [
    // Different ways the data might come from frontend
    ['product_id' => 59, 'uploader_id' => 28, 'note' => 'Both integers'],
    ['product_id' => '59', 'uploader_id' => '28', 'note' => 'Both strings'],
    ['product_id' => 59, 'uploader_id' => '28', 'note' => 'Mixed: int, string'],
    ['product_id' => '59', 'uploader_id' => 28, 'note' => 'Mixed: string, int'],
    ['product_id' => 59.0, 'uploader_id' => 28.0, 'note' => 'Both floats'],
];

foreach ($testCases as $index => $case) {
    echo "Test Case " . ($index + 1) . ": {$case['note']}\n";
    echo "  Product ID: {$case['product_id']} (type: " . gettype($case['product_id']) . ")\n";
    echo "  Uploader ID: {$case['uploader_id']} (type: " . gettype($case['uploader_id']) . ")\n";
    
    // Test the exact UPDATE query used in the code
    $updateSql = "UPDATE products SET product_name = 'TEST' WHERE product_id = :product_id AND uploader_id = :uploader_id";
    
    try {
        $stmt = $pdo->prepare($updateSql);
        $executed = $stmt->execute([
            ':product_id' => $case['product_id'],
            ':uploader_id' => $case['uploader_id']
        ]);
        
        $rowCount = $stmt->rowCount();
        
        if ($rowCount > 0) {
            echo "  ✅ UPDATE SUCCEEDED (rows affected: $rowCount)\n";
            
            // Restore original name
            $restoreSql = "UPDATE products SET product_name = 'BMX' WHERE product_id = :product_id";
            $restoreStmt = $pdo->prepare($restoreSql);
            $restoreStmt->execute([':product_id' => $case['product_id']]);
        } else {
            echo "  ❌ UPDATE FAILED (no rows affected)\n";
        }
        
    } catch (Exception $e) {
        echo "  ❌ QUERY ERROR: " . $e->getMessage() . "\n";
    }
    
    echo "\n";
}

// Test with explicit type casting
echo "🔍 Testing with Type Casting:\n\n";

$castingTests = [
    ['note' => 'Casting to int()', 'product_id' => (int)'59', 'uploader_id' => (int)'28'],
    ['note' => 'Casting to string', 'product_id' => (string)59, 'uploader_id' => (string)28],
    ['note' => 'Using intval()', 'product_id' => intval('59'), 'uploader_id' => intval('28')],
];

foreach ($castingTests as $index => $case) {
    echo "Casting Test " . ($index + 1) . ": {$case['note']}\n";
    echo "  Product ID: {$case['product_id']} (type: " . gettype($case['product_id']) . ")\n";
    echo "  Uploader ID: {$case['uploader_id']} (type: " . gettype($case['uploader_id']) . ")\n";
    
    $updateSql = "UPDATE products SET product_name = 'CAST_TEST' WHERE product_id = :product_id AND uploader_id = :uploader_id";
    
    try {
        $stmt = $pdo->prepare($updateSql);
        $executed = $stmt->execute([
            ':product_id' => $case['product_id'],
            ':uploader_id' => $case['uploader_id']
        ]);
        
        $rowCount = $stmt->rowCount();
        
        if ($rowCount > 0) {
            echo "  ✅ CASTING FIXED IT! (rows affected: $rowCount)\n";
            
            // Restore original name
            $restoreSql = "UPDATE products SET product_name = 'BMX' WHERE product_id = :product_id";
            $restoreStmt = $pdo->prepare($restoreSql);
            $restoreStmt->execute([':product_id' => $case['product_id']]);
        } else {
            echo "  ❌ CASTING DIDN'T HELP\n";
        }
        
    } catch (Exception $e) {
        echo "  ❌ QUERY ERROR: " . $e->getMessage() . "\n";
    }
    
    echo "\n";
}

// Simulate the exact JSON data that might be coming from frontend
echo "🔍 Testing JSON Decoding Scenarios:\n\n";

$jsonTests = [
    '{"product_id": 59, "uploader_id": 28}',
    '{"product_id": "59", "uploader_id": "28"}',
    '{"product_id": 59.0, "uploader_id": 28.0}',
];

foreach ($jsonTests as $index => $jsonData) {
    echo "JSON Test " . ($index + 1) . ": $jsonData\n";
    
    $decoded = json_decode($jsonData);
    
    if ($decoded) {
        echo "  Decoded Product ID: {$decoded->product_id} (type: " . gettype($decoded->product_id) . ")\n";
        echo "  Decoded Uploader ID: {$decoded->uploader_id} (type: " . gettype($decoded->uploader_id) . ")\n";
        
        $updateSql = "UPDATE products SET product_name = 'JSON_TEST' WHERE product_id = :product_id AND uploader_id = :uploader_id";
        
        try {
            $stmt = $pdo->prepare($updateSql);
            $executed = $stmt->execute([
                ':product_id' => $decoded->product_id,
                ':uploader_id' => $decoded->uploader_id
            ]);
            
            $rowCount = $stmt->rowCount();
            
            if ($rowCount > 0) {
                echo "  ✅ JSON DATA WORKS! (rows affected: $rowCount)\n";
                
                // Restore original name
                $restoreSql = "UPDATE products SET product_name = 'BMX' WHERE product_id = :product_id";
                $restoreStmt = $pdo->prepare($restoreSql);
                $restoreStmt->execute([':product_id' => $decoded->product_id]);
            } else {
                echo "  ❌ JSON DATA FAILED\n";
            }
            
        } catch (Exception $e) {
            echo "  ❌ QUERY ERROR: " . $e->getMessage() . "\n";
        }
    } else {
        echo "  ❌ JSON DECODE FAILED\n";
    }
    
    echo "\n";
}

echo "🎯 RECOMMENDATIONS:\n";
echo "1. Add explicit type casting in updateProduct function\n";
echo "2. Log the exact data types being received\n";
echo "3. Use intval() or (int) casting for both IDs\n";
echo "4. Check if JSON decoding is affecting data types\n";
?>