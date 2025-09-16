<?php
/**
 * Setup Admin Table
 * Run this script once to create the admins table and add a default admin user
 */

require_once 'api/config/database.php';

try {
    $database = new Connection();
    $pdo = $database->connect();
    
    // Check if admins table exists
    $tableExists = $pdo->query("SHOW TABLES LIKE 'admins'")->rowCount() > 0;
    
    if (!$tableExists) {
        // Create admins table if it doesn't exist
        $createTableSQL = "
            CREATE TABLE `admins` (
                `id` int(11) NOT NULL AUTO_INCREMENT,
                `username` varchar(50) NOT NULL UNIQUE,
                `email` varchar(100) NOT NULL,
                `password` varchar(255) NOT NULL,
                `role` enum('super_admin','moderator','support') DEFAULT 'moderator',
                `status` enum('active','inactive') DEFAULT 'active',
                `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
                `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (`id`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        ";
        
        $pdo->exec($createTableSQL);
        echo "✅ Admins table created successfully!\n";
    } else {
        echo "ℹ️  Admins table already exists.\n";
        
        // Check if status column exists, if not add it
        $columnsResult = $pdo->query("SHOW COLUMNS FROM admins LIKE 'status'");
        if ($columnsResult->rowCount() == 0) {
            echo "⚠️  Adding missing 'status' column...\n";
            $pdo->exec("ALTER TABLE admins ADD COLUMN status ENUM('active','inactive') DEFAULT 'active'");
            echo "✅ Status column added!\n";
        }
        
        // Check if role column exists, if not add it
        $roleResult = $pdo->query("SHOW COLUMNS FROM admins LIKE 'role'");
        if ($roleResult->rowCount() == 0) {
            echo "⚠️  Adding missing 'role' column...\n";
            $pdo->exec("ALTER TABLE admins ADD COLUMN role ENUM('super_admin','moderator','support') DEFAULT 'moderator'");
            echo "✅ Role column added!\n";
        }
    }
    
    // Check if default admin exists
    $checkAdmin = $pdo->prepare("SELECT COUNT(*) FROM admins WHERE username = 'admin'");
    $checkAdmin->execute();
    $adminExists = $checkAdmin->fetchColumn();
    
    if ($adminExists == 0) {
        // Create default admin user - handle missing columns gracefully
        $defaultPassword = 'admin123'; // Change this to a secure password
        $hashedPassword = password_hash($defaultPassword, PASSWORD_DEFAULT);
        
        // Check what columns exist and build insert query accordingly
        $columns = [];
        $values = [];
        $params = [];
        
        $columns[] = 'username';
        $values[] = ':username';
        $params['username'] = 'admin';
        
        $columns[] = 'email';
        $values[] = ':email';
        $params['email'] = 'admin@cyclemart.com';
        
        $columns[] = 'password';
        $values[] = ':password';
        $params['password'] = $hashedPassword;
        
        // Check if role column exists
        $roleResult = $pdo->query("SHOW COLUMNS FROM admins LIKE 'role'");
        if ($roleResult->rowCount() > 0) {
            $columns[] = 'role';
            $values[] = ':role';
            $params['role'] = 'super_admin';
        }
        
        // Check if status column exists
        $statusResult = $pdo->query("SHOW COLUMNS FROM admins LIKE 'status'");
        if ($statusResult->rowCount() > 0) {
            $columns[] = 'status';
            $values[] = ':status';
            $params['status'] = 'active';
        }
        
        $insertSQL = "INSERT INTO admins (" . implode(', ', $columns) . ") VALUES (" . implode(', ', $values) . ")";
        $insertAdmin = $pdo->prepare($insertSQL);
        $insertAdmin->execute($params);
        
        echo "✅ Default admin user created!\n";
        echo "   Username: admin\n";
        echo "   Password: admin123\n";
        echo "   ⚠️  Please change the password after first login!\n";
    } else {
        echo "ℹ️  Default admin user already exists.\n";
    }
    
    // Show table structure
    $describeTable = $pdo->query("DESCRIBE admins");
    echo "\n📊 Admins table structure:\n";
    while ($column = $describeTable->fetch(PDO::FETCH_ASSOC)) {
        echo "   {$column['Field']} ({$column['Type']}) {$column['Null']} {$column['Key']}\n";
    }
    
} catch (Exception $e) {
    echo "❌ Error setting up admin table: " . $e->getMessage() . "\n";
}
?>
