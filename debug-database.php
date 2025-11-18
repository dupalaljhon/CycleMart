<?php
// Debug script to check database and conversations
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once 'CycleMart-api/config/database.php';

try {
    $database = new Database();
    $pdo = $database->getConnection();
    
    echo "<h1>🔍 System Message Debug Information</h1>";
    
    // Check conversations table
    echo "<h2>📋 Conversations Table</h2>";
    $stmt = $pdo->query("SELECT * FROM conversations ORDER BY conversation_id DESC LIMIT 5");
    $conversations = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo "<pre>";
    foreach ($conversations as $conv) {
        echo "Conversation ID: " . $conv['conversation_id'] . "\n";
        echo "  Product ID: " . $conv['product_id'] . "\n";
        echo "  Buyer ID: " . $conv['buyer_id'] . "\n";  
        echo "  Seller ID: " . $conv['seller_id'] . "\n";
        echo "  Created: " . $conv['created_at'] . "\n";
        echo "---\n";
    }
    echo "</pre>";
    
    // Check messages table structure
    echo "<h2>📝 Messages Table Structure</h2>";
    $stmt = $pdo->query("DESCRIBE messages");
    $columns = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo "<pre>";
    foreach ($columns as $col) {
        echo $col['Field'] . " - " . $col['Type'] . " - " . $col['Null'] . " - " . $col['Default'] . "\n";
    }
    echo "</pre>";
    
    // Check recent messages
    echo "<h2>💬 Recent Messages (All)</h2>";
    $stmt = $pdo->query("SELECT m.*, u.full_name as sender_name 
                         FROM messages m 
                         LEFT JOIN users u ON m.sender_id = u.id 
                         ORDER BY m.created_at DESC LIMIT 10");
    $messages = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo "<pre>";
    foreach ($messages as $msg) {
        echo "Message ID: " . $msg['message_id'] . "\n";
        echo "  Conversation: " . $msg['conversation_id'] . "\n";
        echo "  Sender: " . $msg['sender_id'] . " (" . ($msg['sender_name'] ?: 'System') . ")\n";
        echo "  System Message: " . ($msg['sender_id'] == 0 ? 'YES' : 'NO') . "\n";
        echo "  Text: " . substr($msg['message_text'], 0, 100) . "...\n";
        echo "  Created: " . $msg['created_at'] . "\n";
        echo "---\n";
    }
    echo "</pre>";
    
    // Check system messages specifically
    echo "<h2>🟢 System Messages Only</h2>";
    $stmt = $pdo->query("SELECT * FROM messages WHERE sender_id = 0 ORDER BY created_at DESC LIMIT 5");
    $systemMessages = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    if (empty($systemMessages)) {
        echo "<p style='color: red; font-weight: bold;'>❌ NO SYSTEM MESSAGES FOUND IN DATABASE!</p>";
    } else {
        echo "<pre>";
        foreach ($systemMessages as $msg) {
            echo "System Message ID: " . $msg['message_id'] . "\n";
            echo "  Conversation: " . $msg['conversation_id'] . "\n";
            echo "  Text: " . $msg['message_text'] . "\n";
            echo "  Created: " . $msg['created_at'] . "\n";
            echo "---\n";
        }
        echo "</pre>";
    }
    
    // Check products table for status
    echo "<h2>📦 Products Table (Recent)</h2>";
    $stmt = $pdo->query("SELECT id, product_name, sale_status, uploader_id FROM products ORDER BY id DESC LIMIT 5");
    $products = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo "<pre>";
    foreach ($products as $prod) {
        echo "Product ID: " . $prod['id'] . "\n";
        echo "  Name: " . $prod['product_name'] . "\n";
        echo "  Status: " . $prod['sale_status'] . "\n";
        echo "  Uploader: " . $prod['uploader_id'] . "\n";
        echo "---\n";
    }
    echo "</pre>";

} catch (Exception $e) {
    echo "<h2 style='color: red;'>❌ Database Error</h2>";
    echo "<p>" . $e->getMessage() . "</p>";
}
?>