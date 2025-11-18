<?php
/**
 * REST API Endpoint: Send Verification Email
 * 
 * This endpoint handles sending verification emails via JSON API calls
 * Designed to be called from Angular frontend
 * 
 * HTTP Method: POST
 * Content-Type: application/json
 * 
 * Request Body:
 * {
 *   "email": "user@example.com",
 *   "token": "verification_token_here"
 * }
 * 
 * Response:
 * {
 *   "status": "success|error",
 *   "message": "Description of result"
 * }
 */

// Enable error reporting for debugging (disable in production)
error_reporting(E_ALL);
ini_set('display_errors', 1);

// Set CORS headers to allow Angular frontend access
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Access-Control-Allow-Credentials: true");
header("Content-Type: application/json");

// Handle preflight OPTIONS requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Only allow POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405); // Method Not Allowed
    echo json_encode([
        'status' => 'error',
        'message' => 'Only POST method is allowed'
    ]);
    exit;
}

// Include the email service
require_once '../sendMail.php';

/**
 * Send JSON response and exit
 */
function sendJsonResponse($status, $message, $httpCode = 200) {
    http_response_code($httpCode);
    echo json_encode([
        'status' => $status,
        'message' => $message
    ]);
    exit;
}

/**
 * Validate email format
 */
function isValidEmail($email) {
    return filter_var($email, FILTER_VALIDATE_EMAIL) !== false;
}

/**
 * Validate token format (basic validation)
 */
function isValidToken($token) {
    // Token should be non-empty string, at least 10 characters
    return is_string($token) && strlen(trim($token)) >= 10;
}

// Get JSON input from request body
$jsonInput = file_get_contents('php://input');

// Check if we received any input
if (empty($jsonInput)) {
    sendJsonResponse('error', 'No JSON data received', 400);
}

// Decode JSON input
$data = json_decode($jsonInput, true);

// Check for JSON decode errors
if (json_last_error() !== JSON_ERROR_NONE) {
    sendJsonResponse('error', 'Invalid JSON format: ' . json_last_error_msg(), 400);
}

// Validate required fields
if (!isset($data['email']) || !isset($data['token'])) {
    sendJsonResponse('error', 'Missing required fields: email and token are required', 400);
}

$email = trim($data['email']);
$token = trim($data['token']);

// Validate email format
if (empty($email) || !isValidEmail($email)) {
    sendJsonResponse('error', 'Invalid email address format', 400);
}

// Validate token
if (empty($token) || !isValidToken($token)) {
    sendJsonResponse('error', 'Invalid token format', 400);
}

// Optional: Log the request for debugging (remove in production)
error_log("Verification email request - Email: {$email}, Token: " . substr($token, 0, 10) . "...");

try {
    // Call the custom verification email function
    $result = sendCustomVerificationEmail($email, $token);
    
    // Check the result from sendMail.php
    if ($result['status'] === 'success') {
        sendJsonResponse('success', 'Verification email sent successfully');
    } else {
        // Log the error for debugging
        error_log("Failed to send verification email: " . $result['message']);
        sendJsonResponse('error', 'Failed to send verification email: ' . $result['message'], 500);
    }
    
} catch (Exception $e) {
    // Log the exception
    error_log("Exception in sendVerification.php: " . $e->getMessage());
    sendJsonResponse('error', 'An unexpected error occurred while sending email', 500);
} catch (Error $e) {
    // Log fatal errors
    error_log("Fatal error in sendVerification.php: " . $e->getMessage());
    sendJsonResponse('error', 'A system error occurred', 500);
}

// This should never be reached, but just in case
sendJsonResponse('error', 'Unknown error occurred', 500);
?>