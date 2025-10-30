<?php
/**
 * Email Verification Handler - Confirm Account
 * This page handles the "Yes, it was me" verification link
 */

// Enable error reporting for debugging
error_reporting(E_ALL);
ini_set('display_errors', 1);

// Get parameters from URL
$token = $_GET['token'] ?? '';
$email = $_GET['email'] ?? '';

// Validate parameters
if (empty($token) || empty($email)) {
    $error = "Missing verification parameters";
} else {
    // Here you would typically:
    // 1. Connect to your database
    // 2. Verify the token exists and hasn't expired
    // 3. Mark the user as verified
    // 4. Delete the verification token
    
    // For now, we'll simulate a successful verification
    $success = true;
    $user_email = htmlspecialchars($email);
}
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Email Verification - Cycle MRT</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            background: linear-gradient(135deg, #6BA3BE 0%, #4a8ba8 100%);
            margin: 0;
            padding: 20px;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .container {
            background: white;
            max-width: 500px;
            width: 100%;
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
            color: white;
            padding: 30px 20px;
            text-align: center;
        }
        .header.error {
            background: linear-gradient(135deg, #dc3545 0%, #e74c3c 100%);
        }
        .content {
            padding: 40px 30px;
            text-align: center;
        }
        .icon {
            font-size: 48px;
            margin-bottom: 20px;
        }
        .title {
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 10px;
            color: #333;
        }
        .message {
            font-size: 16px;
            color: #666;
            line-height: 1.6;
            margin-bottom: 30px;
        }
        .btn {
            display: inline-block;
            padding: 12px 30px;
            background: #6BA3BE;
            color: white;
            text-decoration: none;
            border-radius: 6px;
            font-weight: bold;
            transition: background 0.3s ease;
        }
        .btn:hover {
            background: #5a92a5;
        }
        .footer {
            background: #f8f9fa;
            padding: 20px;
            text-align: center;
            color: #6c757d;
            font-size: 14px;
        }
        .details {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 6px;
            margin: 20px 0;
            font-size: 14px;
            color: #495057;
        }
    </style>
</head>
<body>
    <div class="container">
        <?php if (isset($error)): ?>
            <!-- Error State -->
            <div class="header error">
                <div class="icon">❌</div>
                <h1>Verification Failed</h1>
            </div>
            <div class="content">
                <div class="title">Unable to Verify Account</div>
                <div class="message"><?php echo htmlspecialchars($error); ?></div>
                <a href="#" class="btn">Contact Support</a>
            </div>
        <?php else: ?>
            <!-- Success State -->
            <div class="header">
                <div class="icon">✅</div>
                <h1>Email Verified Successfully!</h1>
            </div>
            <div class="content">
                <div class="title">Welcome to Cycle MRT</div>
                <div class="message">
                    Thank you for verifying your email address. Your account has been successfully activated.
                </div>
                
                <div class="details">
                    <strong>Verified Email:</strong> <?php echo $user_email; ?><br>
                    <strong>Verification Time:</strong> <?php echo date('Y-m-d H:i:s'); ?><br>
                    <strong>Token:</strong> <?php echo htmlspecialchars(substr($token, 0, 10) . '...'); ?>
                </div>
                
                <div class="message">
                    You can now log in to your account and start exploring our premium bike parts and cycling accessories.
                </div>
                
                <a href="http://localhost:4200/login" class="btn">Go to Login</a>
            </div>
        <?php endif; ?>
        
        <div class="footer">
            <p>© <?php echo date('Y'); ?> Cycle MRT. All rights reserved.</p>
            <p>If you have any questions, contact us at cyclemrt@gmail.com</p>
        </div>
    </div>
</body>
</html>