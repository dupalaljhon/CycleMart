<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json");

// API Directory - Provide basic information
echo json_encode([
    "name" => "CycleMart API",
    "version" => "1.0",
    "status" => "active",
    "timestamp" => date('Y-m-d H:i:s'),
    "endpoints" => [
        "POST /login" => "User login",
        "POST /register" => "User registration",
        "GET /user?id={id}" => "Get user by ID",
        "GET /all-products" => "Get all products",
        "GET /health.php" => "Health check",
        "GET /test-db-connection.php" => "Test database connection"
    ],
    "documentation" => "https://cyclemart.shop/api-docs"
], JSON_PRETTY_PRINT);
