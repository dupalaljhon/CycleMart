<?php
require_once 'api/config/database.php';

try {
    $database = new Connection();
    $pdo = $database->connect();
    
    // Create a test admin user for login testing
    $testUsername = 'admin';
    $testPassword = 'admin123';
    $hashedPassword = password_hash($testPassword, PASSWORD_DEFAULT);
    
    // Check if test admin already exists
    $checkStmt = $pdo->prepare("SELECT admin_id FROM admins WHERE username = :username");
    $checkStmt->execute(['username' => $testUsername]);
    
    if ($checkStmt->rowCount() == 0) {
        // Insert test admin
        $insertStmt = $pdo->prepare("
            INSERT INTO admins (username, email, password, full_name, role, status) 
            VALUES (:username, :email, :password, :full_name, :role, :status)
        ");
        
        $insertStmt->execute([
            'username' => $testUsername,
            'email' => 'test.admin@cyclemart.com',
            'password' => $hashedPassword,
            'full_name' => 'Test Admin',
            'role' => 'super_admin',
            'status' => 'active'
        ]);
        
        echo "✅ Test admin user created!\n";
        echo "   Username: admin\n";
        echo "   Password: admin123\n";
        echo "   Email: test.admin@cyclemart.com\n";
    } else {
        echo "ℹ️  Test admin user already exists.\n";
        
        // Update password for existing admin user
        $updateStmt = $pdo->prepare("UPDATE admins SET password = :password WHERE username = :username");
        $updateStmt->execute([
            'password' => $hashedPassword,
            'username' => $testUsername
        ]);
        echo "✅ Updated password for existing admin user.\n";
        echo "   Username: admin\n";
        echo "   Password: admin123\n";
    }
    
} catch (Exception $e) {
    echo "❌ Error: " . $e->getMessage() . "\n";
}
?>
