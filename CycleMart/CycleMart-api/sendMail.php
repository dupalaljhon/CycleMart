<?php
/**
 * Email Sending Script using PHPMailer
 * Configured for Gmail SMTP with verification email functionality
 * 
 * Usage:
 * - Include this file and call sendEmail() function
 * - Or use via POST request with recipient, subject, body parameters
 */

// Include PHPMailer autoloader
require_once __DIR__ . '/api/modules/vendor/autoload.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\SMTP;
use PHPMailer\PHPMailer\Exception;

// Gmail SMTP Configuration
define('SMTP_HOST', 'smtp.gmail.com');
define('SMTP_PORT', 587);
define('SMTP_USERNAME', 'cyclemrt@gmail.com');
define('SMTP_PASSWORD', 'ewmz ldjg hvxv cmkv'); // App Password
define('SMTP_FROM_EMAIL', 'cyclemrt@gmail.com');
define('SMTP_FROM_NAME', 'Cycle MRT System');

/**
 * Send email using PHPMailer with Gmail SMTP
 * 
 * @param string $recipientEmail - Email address to send to
 * @param string $subject - Email subject
 * @param string $body - Email body (HTML or plain text)
 * @param string $recipientName - Optional recipient name
 * @param bool $isHTML - Whether the body is HTML (default: true)
 * @return array - Response with status and message
 */
function sendEmail($recipientEmail, $subject, $body, $recipientName = '', $isHTML = true) {
    // Create PHPMailer instance
    $mail = new PHPMailer(true);
    
    try {
        // Server settings
        $mail->isSMTP();
        $mail->Host       = SMTP_HOST;
        $mail->SMTPAuth   = true;
        $mail->Username   = SMTP_USERNAME;
        $mail->Password   = SMTP_PASSWORD;
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
        $mail->Port       = SMTP_PORT;
        
        // Enable verbose debug output (disable in production)
        // $mail->SMTPDebug = SMTP::DEBUG_SERVER;
        
        // Recipients
        $mail->setFrom(SMTP_FROM_EMAIL, SMTP_FROM_NAME);
        $mail->addAddress($recipientEmail, $recipientName);
        
        // Optional: Add reply-to address
        $mail->addReplyTo(SMTP_FROM_EMAIL, SMTP_FROM_NAME);
        
        // Content
        $mail->isHTML($isHTML);
        $mail->Subject = $subject;
        $mail->Body    = $body;
        
        // If HTML email, set alternative plain text version
        if ($isHTML) {
            $mail->AltBody = strip_tags(str_replace(['<br>', '<br/>', '<br />'], "\n", $body));
        }
        
        // Send email
        $mail->send();
        
        return [
            'status' => 'success',
            'message' => 'Email sent successfully',
            'recipient' => $recipientEmail
        ];
        
    } catch (Exception $e) {
        return [
            'status' => 'error',
            'message' => 'Email could not be sent. Error: ' . $mail->ErrorInfo,
            'recipient' => $recipientEmail
        ];
    }
}

/**
 * Send verification email with pre-formatted template
 * 
 * @param string $recipientEmail - User's email address
 * @param string $recipientName - User's full name
 * @param string $verificationToken - Verification token
 * @param string $baseUrl - Base URL of your application
 * @return array - Response with status and message
 */
function sendVerificationEmail($recipientEmail, $recipientName, $verificationToken, $baseUrl = 'http://localhost:4200') {
    $subject = 'Verify Your CycleMart Account';
    
    // Create verification URL
    $verificationUrl = $baseUrl . '/email-verification?token=' . urlencode($verificationToken);
    
    // HTML email template
    $body = '
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verify Your CycleMart Account</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #6BA3BE; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
            .btn { display: inline-block; padding: 12px 24px; background: #6BA3BE; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; }
            .btn:hover { background: #5a92a5; }
            .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🚴 Welcome to CycleMart!</h1>
            </div>
            <div class="content">
                <h2>Hello ' . htmlspecialchars($recipientName) . '!</h2>
                <p>Thank you for registering with CycleMart, your ultimate destination for premium bike parts and cycling accessories.</p>
                
                <p>To complete your registration and activate your account, please verify your email address by clicking the button below:</p>
                
                <div style="text-align: center; margin: 30px 0;">
                    <a href="' . htmlspecialchars($verificationUrl) . '" class="btn">Verify My Account</a>
                </div>
                
                <p>If the button above doesn\'t work, you can copy and paste this link into your browser:</p>
                <p style="word-break: break-all; background: #e9e9e9; padding: 10px; border-radius: 4px;">
                    ' . htmlspecialchars($verificationUrl) . '
                </p>
                
                <p><strong>Important:</strong> This verification link will expire in 24 hours for security reasons.</p>
                
                <p>If you didn\'t create this account, please ignore this email.</p>
                
                <p>Best regards,<br>The CycleMart Team</p>
            </div>
            <div class="footer">
                <p>© ' . date('Y') . ' CycleMart. All rights reserved.</p>
                <p>This is an automated email. Please do not reply.</p>
            </div>
        </div>
    </body>
    </html>';
    
    return sendEmail($recipientEmail, $subject, $body, $recipientName, true);
}

/**
 * Send email change verification email
 * 
 * @param string $recipientEmail - User's new email address
 * @param string $recipientName - User's full name
 * @param string $verificationToken - Verification token
 * @param string $baseUrl - Base URL of your application
 * @return array - Response with status and message
 */
function sendEmailChangeVerificationEmail($recipientEmail, $recipientName, $verificationToken, $baseUrl = 'http://localhost:4200') {
    $subject = 'Verify Your New Email Address - CycleMart';
    
    // Create verification URL
    $verificationUrl = $baseUrl . '/email-verification?token=' . urlencode($verificationToken);
    
    // HTML email template
    $body = '
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verify Your New Email Address</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #6BA3BE; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
            .btn { display: inline-block; padding: 12px 24px; background: #6BA3BE; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; }
            .btn:hover { background: #5a92a5; }
            .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
            .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 4px; margin: 20px 0; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>📧 Email Address Change</h1>
            </div>
            <div class="content">
                <h2>Hello ' . htmlspecialchars($recipientName) . '!</h2>
                <p>We received a request to change your email address on your CycleMart account to this email address.</p>
                
                <p>To confirm this email change and verify your new email address, please click the button below:</p>
                
                <div style="text-align: center; margin: 30px 0;">
                    <a href="' . htmlspecialchars($verificationUrl) . '" class="btn">Verify New Email Address</a>
                </div>
                
                <p>If the button above doesn\'t work, you can copy and paste this link into your browser:</p>
                <p style="word-break: break-all; background: #e9e9e9; padding: 10px; border-radius: 4px;">
                    ' . htmlspecialchars($verificationUrl) . '
                </p>
                
                <div class="warning">
                    <strong>Important Security Information:</strong>
                    <ul>
                        <li>This verification link will expire in 24 hours</li>
                        <li>Your account has been temporarily unverified for security</li>
                        <li>You will need to verify this new email address to regain full access</li>
                        <li>If you didn\'t request this email change, please contact support immediately</li>
                    </ul>
                </div>
                
                <p>After verification, you can log back into your CycleMart account using this new email address.</p>
                
                <p>Best regards,<br>The CycleMart Team</p>
            </div>
            <div class="footer">
                <p>© ' . date('Y') . ' CycleMart. All rights reserved.</p>
                <p>This is an automated email. Please do not reply.</p>
            </div>
        </div>
    </body>
    </html>';
    
    return sendEmail($recipientEmail, $subject, $body, $recipientName, true);
}

/**
 * Send password reset email
 * 
 * @param string $recipientEmail - User's email address
 * @param string $recipientName - User's full name
 * @param string $resetToken - Password reset token
 * @param string $baseUrl - Base URL of your application
 * @return array - Response with status and message
 */
function sendPasswordResetEmail($recipientEmail, $recipientName, $resetToken, $baseUrl = 'http://localhost:4200') {
    $subject = 'Reset Your CycleMart Password';
    
    // Create reset URL
    $resetUrl = $baseUrl . '/reset-password?token=' . urlencode($resetToken);
    
    // HTML email template
    $body = '
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset Your CycleMart Password</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #6BA3BE; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
            .btn { display: inline-block; padding: 12px 24px; background: #6BA3BE; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; }
            .btn:hover { background: #5a92a5; }
            .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
            .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 4px; margin: 20px 0; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🔐 Password Reset Request</h1>
            </div>
            <div class="content">
                <h2>Hello ' . htmlspecialchars($recipientName) . '!</h2>
                <p>We received a request to reset the password for your CycleMart account.</p>
                
                <p>To reset your password, please click the button below:</p>
                
                <div style="text-align: center; margin: 30px 0;">
                    <a href="' . htmlspecialchars($resetUrl) . '" class="btn">Reset My Password</a>
                </div>
                
                <p>If the button above doesn\'t work, you can copy and paste this link into your browser:</p>
                <p style="word-break: break-all; background: #e9e9e9; padding: 10px; border-radius: 4px;">
                    ' . htmlspecialchars($resetUrl) . '
                </p>
                
                <div class="warning">
                    <strong>Security Notice:</strong>
                    <ul>
                        <li>This password reset link will expire in 1 hour</li>
                        <li>If you didn\'t request this reset, please ignore this email</li>
                        <li>Your password will remain unchanged until you create a new one</li>
                    </ul>
                </div>
                
                <p>For your security, we recommend choosing a strong password that includes:</p>
                <ul>
                    <li>At least 8 characters</li>
                    <li>A mix of uppercase and lowercase letters</li>
                    <li>Numbers and special characters</li>
                </ul>
                
                <p>Best regards,<br>The CycleMart Team</p>
            </div>
            <div class="footer">
                <p>© ' . date('Y') . ' CycleMart. All rights reserved.</p>
                <p>This is an automated email. Please do not reply.</p>
            </div>
        </div>
    </body>
    </html>';
    
    return sendEmail($recipientEmail, $subject, $body, $recipientName, true);
}

/**
 * Send custom verification email with Yes/No buttons
 * 
 * @param string $recipientEmail - User's email address
 * @param string $token - Verification token
 * @return array - Response with status and message
 */
function sendCustomVerificationEmail($recipientEmail, $token) {
    $subject = 'Verify your Cycle MRT account';
    
    // Create verification URLs
    $verifyUrl = 'https://mywebsite.com/verify.php?token=' . urlencode($token) . '&email=' . urlencode($recipientEmail);
    $denyUrl = 'https://mywebsite.com/deny.php?token=' . urlencode($token) . '&email=' . urlencode($recipientEmail);
    
    // HTML email template with centered card design
    $body = '
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verify your Cycle MRT account</title>
        <style>
            body { 
                font-family: Arial, sans-serif; 
                line-height: 1.6; 
                color: #333; 
                background-color: #f4f4f4; 
                margin: 0; 
                padding: 20px;
            }
            .container { 
                max-width: 600px; 
                margin: 0 auto; 
                background-color: #ffffff;
                border-radius: 12px;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                overflow: hidden;
            }
            .header { 
                background: linear-gradient(135deg, #6BA3BE 0%, #4a8ba8 100%); 
                color: white; 
                padding: 30px 20px; 
                text-align: center; 
            }
            .content { 
                background: #ffffff; 
                padding: 40px 30px; 
                text-align: center; 
            }
            .message {
                font-size: 18px;
                color: #555;
                margin-bottom: 30px;
                font-weight: 500;
            }
            .button-container {
                margin: 30px 0;
                text-align: center;
            }
            .btn { 
                display: inline-block; 
                padding: 15px 30px; 
                margin: 10px 15px;
                text-decoration: none; 
                border-radius: 8px; 
                font-weight: bold; 
                font-size: 16px;
                transition: all 0.3s ease;
                border: none;
                cursor: pointer;
            }
            .btn-yes { 
                background-color: #28a745; 
                color: white; 
            }
            .btn-yes:hover { 
                background-color: #218838; 
                transform: translateY(-2px);
                box-shadow: 0 4px 8px rgba(40, 167, 69, 0.3);
            }
            .btn-no { 
                background-color: #dc3545; 
                color: white; 
            }
            .btn-no:hover { 
                background-color: #c82333; 
                transform: translateY(-2px);
                box-shadow: 0 4px 8px rgba(220, 53, 69, 0.3);
            }
            .footer { 
                background-color: #f8f9fa;
                padding: 20px; 
                text-align: center; 
                font-size: 14px; 
                color: #6c757d; 
                border-top: 1px solid #e9ecef;
            }
            .logo {
                font-size: 24px;
                font-weight: bold;
                margin-bottom: 10px;
            }
            .subtitle {
                font-size: 16px;
                opacity: 0.9;
            }
            .warning {
                margin-top: 20px;
                font-size: 13px;
                color: #dc3545;
                font-weight: 500;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo">🚴 Cycle MRT</div>
                <div class="subtitle">Account Verification</div>
            </div>
            <div class="content">
                <h2 style="color: #333; margin-bottom: 20px;">Email Verification Required</h2>
                <p class="message">Click below to confirm your email</p>
                
                <div class="button-container">
                    <a href="' . htmlspecialchars($verifyUrl) . '" class="btn btn-yes">✅ Yes, it was me</a>
                    <a href="' . htmlspecialchars($denyUrl) . '" class="btn btn-no">❌ No, not me</a>
                </div>
                
                <p style="margin-top: 30px; font-size: 14px; color: #666;">
                    This verification link was sent to: <strong>' . htmlspecialchars($recipientEmail) . '</strong>
                </p>
            </div>
            <div class="footer">
                <p class="warning">Choosing "No" will cancel the account request.</p>
                <p>© ' . date('Y') . ' Cycle MRT. All rights reserved.</p>
                <p>This is an automated email. Please do not reply.</p>
            </div>
        </div>
    </body>
    </html>';
    
    return sendEmail($recipientEmail, $subject, $body, '', true);
}

// Handle direct POST requests to this script
if (false && $_SERVER['REQUEST_METHOD'] === 'POST') { // Temporarily disabled
    // Set CORS headers
    header("Access-Control-Allow-Origin: *");
    header("Access-Control-Allow-Methods: POST, OPTIONS");
    header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
    header("Content-Type: application/json");
    
    // Handle preflight requests
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(200);
        exit;
    }
    
    // Get POST data
    $input = json_decode(file_get_contents('php://input'), true);
    
    // Extract parameters
    $recipient = $input['recipient'] ?? '';
    $subject = $input['subject'] ?? '';
    $body = $input['body'] ?? '';
    $recipientName = $input['recipient_name'] ?? '';
    $isHTML = $input['is_html'] ?? true;
    
    // Validate required parameters
    if (empty($recipient) || empty($subject) || empty($body)) {
        echo json_encode([
            'status' => 'error',
            'message' => 'Missing required parameters: recipient, subject, body'
        ]);
        exit;
    }
    
    // Validate email format
    if (!filter_var($recipient, FILTER_VALIDATE_EMAIL)) {
        echo json_encode([
            'status' => 'error',
            'message' => 'Invalid email address format'
        ]);
        exit;
    }
    
    // Send email
    $result = sendEmail($recipient, $subject, $body, $recipientName, $isHTML);
    echo json_encode($result);
    exit;
}

// Handle GET requests with query parameters (for testing)
if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['test'])) {
    header("Content-Type: application/json");
    
    echo json_encode([
        'status' => 'info',
        'message' => 'CycleMart Email Service is running',
        'configuration' => [
            'smtp_host' => SMTP_HOST,
            'smtp_port' => SMTP_PORT,
            'from_email' => SMTP_FROM_EMAIL,
            'from_name' => SMTP_FROM_NAME
        ],
        'usage' => [
            'post_params' => ['recipient', 'subject', 'body', 'recipient_name (optional)', 'is_html (optional)'],
            'functions' => ['sendEmail()', 'sendVerificationEmail()', 'sendCustomVerificationEmail()', 'sendPasswordResetEmail()']
        ]
    ]);
    exit;
}
?>