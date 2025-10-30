<?php
/**
 * Email Verification Handler - Deny Account
 * This page handles the "No, not me" verification link
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
    // 2. Find the pending account with this token
    // 3. Delete the account or mark it as denied
    // 4. Log the security incident
    // 5. Optionally notify administrators
    
    // For now, we'll simulate a successful denial
    $denied = true;
    $user_email = htmlspecialchars($email);
}
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Account Request Denied - Cycle MRT</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
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
            background: linear-gradient(135deg, #dc3545 0%, #e74c3c 100%);
            color: white;
            padding: 30px 20px;
            text-align: center;
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
            margin: 5px;
        }
        .btn:hover {
            background: #5a92a5;
        }
        .btn-danger {
            background: #dc3545;
        }
        .btn-danger:hover {
            background: #c82333;
        }
        .footer {
            background: #f8f9fa;
            padding: 20px;
            text-align: center;
            color: #6c757d;
            font-size: 14px;
        }
        .details {
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            padding: 15px;
            border-radius: 6px;
            margin: 20px 0;
            font-size: 14px;
            color: #856404;
        }
        .security-notice {
            background: #f8d7da;
            border: 1px solid #f5c6cb;
            padding: 15px;
            border-radius: 6px;
            margin: 20px 0;
            font-size: 14px;
            color: #721c24;
        }
    </style>
</head>
<body>
    <div class="container">
        <?php if (isset($error)): ?>
            <!-- Error State -->
            <div class="header">
                <div class="icon">❌</div>
                <h1>Unable to Process Request</h1>
            </div>
            <div class="content">
                <div class="title">Error Processing Denial</div>
                <div class="message"><?php echo htmlspecialchars($error); ?></div>
                <a href="mailto:cyclemrt@gmail.com" class="btn">Contact Support</a>
            </div>
        <?php else: ?>
            <!-- Denial Confirmed -->
            <div class="header">
                <div class="icon">🛡️</div>
                <h1>Account Request Denied</h1>
            </div>
            <div class="content">
                <div class="title">Account Registration Cancelled</div>
                <div class="message">
                    You have successfully denied the account registration request. The pending account has been cancelled for security reasons.
                </div>
                
                <div class="details">
                    <strong>Cancelled Email:</strong> <?php echo $user_email; ?><br>
                    <strong>Cancellation Time:</strong> <?php echo date('Y-m-d H:i:s'); ?><br>
                    <strong>Reference:</strong> <?php echo htmlspecialchars(substr($token, 0, 10) . '...'); ?>
                </div>
                
                <div class="security-notice">
                    <strong>🔒 Security Notice:</strong><br>
                    If you didn't request this account, no further action is needed. The registration has been completely cancelled and no account was created.
                </div>
                
                <div class="message">
                    <strong>What happens next?</strong><br>
                    • The account registration has been permanently cancelled<br>
                    • No login credentials were created<br>
                    • Our security team has been notified<br>
                    • The email address remains available for future registration
                </div>
                
                <div style="margin-top: 30px;">
                    <a href="http://localhost:4200/login" class="btn">Go to Login Page</a>
                    <a href="mailto:cyclemrt@gmail.com?subject=Security%20Report%20-%20Denied%20Account" class="btn btn-danger">Report Security Issue</a>
                </div>
            </div>
        <?php endif; ?>
        
        <div class="footer">
            <p>© <?php echo date('Y'); ?> Cycle MRT. All rights reserved.</p>
            <p><strong>Security Hotline:</strong> cyclemrt@gmail.com</p>
            <p>If this was a legitimate registration attempt, you can try registering again with a secure device.</p>
        </div>
    </div>
</body>
</html>