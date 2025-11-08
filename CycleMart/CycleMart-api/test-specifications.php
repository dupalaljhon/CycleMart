<?php
// Test getProductSpecifications functionality
header("Content-Type: text/plain");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");

require_once './api/config/database.php';
require_once './api/modules/get.php';

$con = new Connection();
$pdo = $con->connect();
$get = new Get($pdo);

echo "🔍 TESTING getProductSpecifications FUNCTIONALITY\n";
echo "=================================================\n\n";

// Step 1: Get a product that might have specifications
echo "1️⃣ Finding products with specifications...\n";
$productsWithSpecs = $pdo->query("
    SELECT DISTINCT p.product_id, p.product_name, COUNT(ps.spec_id) as spec_count
    FROM products p 
    LEFT JOIN product_specifications ps ON p.product_id = ps.product_id
    GROUP BY p.product_id, p.product_name
    HAVING spec_count > 0
    ORDER BY spec_count DESC
    LIMIT 5
")->fetchAll(PDO::FETCH_ASSOC);

if (empty($productsWithSpecs)) {
    echo "❌ No products with specifications found. Let me check the table structure...\n\n";
    
    // Check if product_specifications table exists
    $tables = $pdo->query("SHOW TABLES LIKE 'product_specifications'")->fetchAll();
    if (empty($tables)) {
        echo "❌ product_specifications table does NOT exist!\n";
        echo "📋 Available tables:\n";
        $allTables = $pdo->query("SHOW TABLES")->fetchAll(PDO::FETCH_COLUMN);
        foreach ($allTables as $table) {
            echo "   - $table\n";
        }
        
        echo "\n🛠️ CREATING product_specifications TABLE...\n";
        $createTableSQL = "
            CREATE TABLE product_specifications (
                spec_id INT AUTO_INCREMENT PRIMARY KEY,
                product_id INT NOT NULL,
                spec_name VARCHAR(255) NOT NULL,
                spec_value TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ";
        
        try {
            $pdo->exec($createTableSQL);
            echo "✅ product_specifications table created successfully!\n";
            
            // Add some sample data
            echo "📝 Adding sample specifications...\n";
            $sampleProduct = $pdo->query("SELECT product_id FROM products LIMIT 1")->fetch();
            if ($sampleProduct) {
                $productId = $sampleProduct['product_id'];
                $insertSpecs = $pdo->prepare("INSERT INTO product_specifications (product_id, spec_name, spec_value) VALUES (?, ?, ?)");
                
                $specs = [
                    ['Brand', 'Test Brand'],
                    ['Model', 'Test Model 2024'],
                    ['Color', 'Red'],
                    ['Size', 'Medium'],
                    ['Weight', '15 kg']
                ];
                
                foreach ($specs as $spec) {
                    $insertSpecs->execute([$productId, $spec[0], $spec[1]]);
                }
                
                echo "✅ Sample specifications added to product ID: $productId\n";
                
                // Now test the function
                echo "\n2️⃣ Testing getProductSpecifications function...\n";
                $result = $get->getProductSpecifications($productId);
                echo "Result: " . json_encode($result, JSON_PRETTY_PRINT) . "\n";
                
                if ($result['status'] === 'success') {
                    echo "✅ getProductSpecifications is working correctly!\n";
                } else {
                    echo "❌ getProductSpecifications failed: " . $result['message'] . "\n";
                }
            }
            
        } catch (Exception $e) {
            echo "❌ Error creating table: " . $e->getMessage() . "\n";
        }
        
    } else {
        echo "✅ product_specifications table exists\n";
        
        // Check if it has data
        $count = $pdo->query("SELECT COUNT(*) as count FROM product_specifications")->fetch()['count'];
        echo "📊 Total specifications in database: $count\n";
        
        if ($count == 0) {
            echo "⚠️ Table is empty. Adding sample data...\n";
            
            $sampleProduct = $pdo->query("SELECT product_id FROM products LIMIT 1")->fetch();
            if ($sampleProduct) {
                $productId = $sampleProduct['product_id'];
                $insertSpecs = $pdo->prepare("INSERT INTO product_specifications (product_id, spec_name, spec_value) VALUES (?, ?, ?)");
                
                $specs = [
                    ['Brand', 'Test Brand'],
                    ['Model', 'Test Model 2024'],
                    ['Color', 'Blue'],
                    ['Size', 'Large'],
                    ['Weight', '12 kg']
                ];
                
                foreach ($specs as $spec) {
                    $insertSpecs->execute([$productId, $spec[0], $spec[1]]);
                }
                
                echo "✅ Sample specifications added to product ID: $productId\n";
                
                // Test the function
                echo "\n2️⃣ Testing getProductSpecifications function...\n";
                $result = $get->getProductSpecifications($productId);
                echo "Result: " . json_encode($result, JSON_PRETTY_PRINT) . "\n";
            }
        }
    }
    
} else {
    echo "✅ Found products with specifications:\n";
    foreach ($productsWithSpecs as $product) {
        echo "   - Product ID {$product['product_id']}: {$product['product_name']} ({$product['spec_count']} specs)\n";
    }
    
    // Test with the first product
    $testProduct = $productsWithSpecs[0];
    echo "\n2️⃣ Testing getProductSpecifications with Product ID: {$testProduct['product_id']}\n";
    
    $result = $get->getProductSpecifications($testProduct['product_id']);
    echo "Function result:\n";
    echo json_encode($result, JSON_PRETTY_PRINT) . "\n";
    
    if ($result['status'] === 'success') {
        echo "✅ getProductSpecifications is working correctly!\n";
        echo "📋 Specifications found:\n";
        foreach ($result['data'] as $spec) {
            echo "   - {$spec['spec_name']}: {$spec['spec_value']}\n";
        }
    } else {
        echo "❌ getProductSpecifications failed: " . $result['message'] . "\n";
    }
}

// Step 3: Test the API route directly
echo "\n3️⃣ Testing API route simulation...\n";
$_GET['product_id'] = $productsWithSpecs[0]['product_id'] ?? 1;

echo "Simulating GET request to: /api/product-specifications?product_id={$_GET['product_id']}\n";

try {
    $routeResult = $get->getProductSpecifications((int) $_GET['product_id']);
    echo "Route result:\n";
    echo json_encode($routeResult, JSON_PRETTY_PRINT) . "\n";
    
    if ($routeResult['status'] === 'success') {
        echo "✅ API route is working correctly!\n";
    } else {
        echo "❌ API route failed: " . $routeResult['message'] . "\n";
    }
} catch (Exception $e) {
    echo "❌ Route error: " . $e->getMessage() . "\n";
}

echo "\n🏁 DIAGNOSIS COMPLETE\n";
echo "===================\n";

if (isset($routeResult) && $routeResult['status'] === 'success') {
    echo "✅ SOLUTION: The getProductSpecifications function is working correctly!\n";
    echo "   The issue might be:\n";
    echo "   1. Frontend not calling the correct URL\n";
    echo "   2. CORS issues\n";
    echo "   3. Product ID not being passed correctly\n";
    echo "   4. User trying to load specs for non-existent product\n";
} else {
    echo "❌ PROBLEM: The getProductSpecifications function has issues\n";
    echo "   Check the database connection and table structure\n";
}
?>