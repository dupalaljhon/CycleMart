<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json");

// Test if API routing is working
echo json_encode([
    "status" => "success",
    "message" => "API routing test successful",
    "timestamp" => date('Y-m-d H:i:s'),
    "request_method" => $_SERVER['REQUEST_METHOD'],
    "request_uri" => $_SERVER['REQUEST_URI'],
    "request_param" => $_REQUEST['request'] ?? 'NOT SET',
    "server_software" => $_SERVER['SERVER_SOFTWARE'] ?? 'unknown',
    "php_version" => phpversion()
], JSON_PRETTY_PRINT);
