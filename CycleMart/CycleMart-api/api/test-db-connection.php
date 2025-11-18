<?php
// Test different database connection configurations
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");

$results = [];

// Configuration 1: Using localhost
$config1 = [
    'label' => 'Config 1: localhost',
    'host' => 'localhost',
    'database' => 'u385622194_cyclemart',
    'user' => 'u385622194_cyclemart_db',
    'password' => 'CycleMart_CTP'
];

try {
    $pdo1 = new PDO(
        "mysql:host={$config1['host']};dbname={$config1['database']};charset=utf8mb4",
        $config1['user'],
        $config1['password'],
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );
    $results[] = [
        'config' => $config1['label'],
        'status' => 'SUCCESS',
        'message' => 'Connection successful!'
    ];
} catch (PDOException $e) {
    $results[] = [
        'config' => $config1['label'],
        'status' => 'FAILED',
        'error' => $e->getMessage()
    ];
}

// Configuration 2: Using 127.0.0.1
$config2 = [
    'label' => 'Config 2: 127.0.0.1',
    'host' => '127.0.0.1',
    'database' => 'u385622194_cyclemart',
    'user' => 'u385622194_cyclemart_db',
    'password' => 'CycleMart_CTP'
];

try {
    $pdo2 = new PDO(
        "mysql:host={$config2['host']};dbname={$config2['database']};charset=utf8mb4",
        $config2['user'],
        $config2['password'],
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );
    $results[] = [
        'config' => $config2['label'],
        'status' => 'SUCCESS',
        'message' => 'Connection successful!'
    ];
} catch (PDOException $e) {
    $results[] = [
        'config' => $config2['label'],
        'status' => 'FAILED',
        'error' => $e->getMessage()
    ];
}

// Configuration 3: Using external host
$config3 = [
    'label' => 'Config 3: auth-db2054.hstgr.io',
    'host' => 'auth-db2054.hstgr.io',
    'database' => 'u385622194_cyclemart',
    'user' => 'u385622194_cyclemart_db',
    'password' => 'CycleMart_CTP'
];

try {
    $pdo3 = new PDO(
        "mysql:host={$config3['host']};dbname={$config3['database']};charset=utf8mb4",
        $config3['user'],
        $config3['password'],
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );
    $results[] = [
        'config' => $config3['label'],
        'status' => 'SUCCESS',
        'message' => 'Connection successful!'
    ];
} catch (PDOException $e) {
    $results[] = [
        'config' => $config3['label'],
        'status' => 'FAILED',
        'error' => $e->getMessage()
    ];
}

// Server information
$serverInfo = [
    'php_version' => phpversion(),
    'server_ip' => $_SERVER['SERVER_ADDR'] ?? 'unknown',
    'server_name' => $_SERVER['SERVER_NAME'] ?? 'unknown'
];

echo json_encode([
    'test_results' => $results,
    'server_info' => $serverInfo,
    'recommendation' => 'Use the configuration that shows SUCCESS status'
], JSON_PRETTY_PRINT);
