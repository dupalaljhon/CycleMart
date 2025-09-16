<?php
require_once 'api/config/database.php';

try {
    $database = new Connection();
    $pdo = $database->connect();
    
    echo "📊 Admins table structure:\n";
    $result = $pdo->query('DESCRIBE admins');
    while ($col = $result->fetch(PDO::FETCH_ASSOC)) {
        echo "   {$col['Field']} ({$col['Type']}) {$col['Null']} {$col['Key']}\n";
    }
    
    echo "\n👥 Existing admin users:\n";
    $users = $pdo->query('SELECT admin_id, username, email, role FROM admins');
    while ($user = $users->fetch(PDO::FETCH_ASSOC)) {
        echo "   ID: {$user['admin_id']}, Username: {$user['username']}, Email: {$user['email']}, Role: " . ($user['role'] ?? 'N/A') . "\n";
    }
    
} catch (Exception $e) {
    echo "❌ Error: " . $e->getMessage() . "\n";
}
?>
