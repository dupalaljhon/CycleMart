<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json");

$checks = [];

// Check PHP version
$checks['php_version'] = phpversion();

// Check PDO extension
$checks['pdo_available'] = extension_loaded('pdo');
$checks['pdo_mysql_available'] = extension_loaded('pdo_mysql');

// Check if composer autoload exists
$checks['composer_autoload'] = file_exists(__DIR__ . '/modules/vendor/autoload.php');

// Check database connection
try {
    require_once __DIR__ . '/config/database.php';
    $con = new Connection();
    $pdo = $con->connect();
    $checks['database_connection'] = 'success';
    $checks['database_name'] = DATABASE;
} catch (Exception $e) {
    $checks['database_connection'] = 'failed';
    $checks['database_error'] = $e->getMessage();
}

// Check file permissions
$checks['routes_readable'] = is_readable(__DIR__ . '/routes.php');
$checks['modules_dir_readable'] = is_readable(__DIR__ . '/modules');

// Check required files
$requiredFiles = [
    'modules/get.php',
    'modules/post.php',
    'modules/global.php',
    'config/database.php'
];

$checks['required_files'] = [];
foreach ($requiredFiles as $file) {
    $checks['required_files'][$file] = file_exists(__DIR__ . '/' . $file);
}

// Overall status
$allGood = $checks['pdo_available'] && 
           $checks['pdo_mysql_available'] && 
           $checks['composer_autoload'] && 
           $checks['database_connection'] === 'success';

echo json_encode([
    'status' => $allGood ? 'healthy' : 'unhealthy',
    'timestamp' => date('Y-m-d H:i:s'),
    'server' => $_SERVER['SERVER_SOFTWARE'] ?? 'unknown',
    'checks' => $checks
], JSON_PRETTY_PRINT);
