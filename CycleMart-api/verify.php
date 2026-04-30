<?php
/**
 * Email Verification Handler - Confirm Account
 * This page handles the "Yes, it was me" verification link
 */

// Enable error reporting for debugging
error_reporting(E_ALL);
ini_set('display_errors', 1);

require_once __DIR__ . '/api/config/database.php';

// Get parameters from URL
$token = $_GET['token'] ?? '';
$email = $_GET['email'] ?? '';

$state = 'error';
$title = 'Verification Failed';
$message = 'Unable to verify account.';
$user_email = '';
$verification_time = date('Y-m-d H:i:s');

// Validate parameters
if (empty($token)) {
    $message = 'Missing verification token.';
} else {
    try {
        $pdo = (new Connection())->connect();

        // 1) Try verifying by token first
        $stmt = $pdo->prepare("SELECT id, email, full_name, is_verified, token_expires_at FROM users WHERE verification_token = :token LIMIT 1");
        $stmt->execute([':token' => $token]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($user) {
            $user_email = htmlspecialchars($user['email']);

            if ((int)$user['is_verified'] === 1) {
                $state = 'already';
                $title = 'Already Verified';
                $message = 'Your account is already verified. You can log in now.';
            } elseif (strtotime($user['token_expires_at']) < time()) {
                $state = 'expired';
                $title = 'Verification Link Expired';
                $message = 'This verification link has expired. Please request a new verification email.';
            } else {
                $updateStmt = $pdo->prepare("UPDATE users SET is_verified = 1, verification_token = NULL, token_expires_at = NULL WHERE id = :id");
                $updateStmt->execute([':id' => $user['id']]);

                $state = 'success';
                $title = 'Email Verified Successfully!';
                $message = 'Your account has been activated. You can now log in and use CycleMart.';
            }
        } else {
            // 2) Token may have been consumed already. If email is available and already verified, show verified state.
            if (!empty($email)) {
                $emailStmt = $pdo->prepare("SELECT email, is_verified FROM users WHERE email = :email LIMIT 1");
                $emailStmt->execute([':email' => $email]);
                $emailUser = $emailStmt->fetch(PDO::FETCH_ASSOC);

                if ($emailUser && (int)$emailUser['is_verified'] === 1) {
                    $user_email = htmlspecialchars($emailUser['email']);
                    $state = 'already';
                    $title = 'Already Verified';
                    $message = 'This account has already been verified. The verification button is now disabled.';
                } else {
                    $state = 'error';
                    $title = 'Invalid Verification Link';
                    $message = 'The verification link is invalid or has already been used.';
                }
            } else {
                $state = 'error';
                $title = 'Invalid Verification Link';
                $message = 'The verification link is invalid or has already been used.';
            }
        }
    } catch (Throwable $e) {
        $state = 'error';
        $title = 'System Error';
        $message = 'A system error occurred while verifying your account. Please try again later.';
        error_log('verify.php error: ' . $e->getMessage());
    }
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
            background: linear-gradient(135deg, #e8f3ea 0%, #d9eadc 100%);
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
            box-shadow: 0 8px 32px rgba(46, 125, 50, 0.18);
            overflow: hidden;
            border: 1px solid #d6e7d8;
        }
        .header {
            background: linear-gradient(135deg, #2e7d32 0%, #3f9a45 100%);
            color: white;
            padding: 30px 20px;
            text-align: center;
        }
        .header.error {
            background: linear-gradient(135deg, #b91c1c 0%, #dc2626 100%);
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
            color: #1f2937;
        }
        .message {
            font-size: 16px;
            color: #374151;
            line-height: 1.6;
            margin-bottom: 30px;
        }
        .btn {
            display: inline-block;
            padding: 12px 30px;
            background: #2e7d32;
            color: white;
            text-decoration: none;
            border-radius: 6px;
            font-weight: bold;
            transition: background 0.3s ease;
        }
        .btn:hover {
            background: #256b2a;
        }
        .footer {
            background: #f3f7f4;
            padding: 20px;
            text-align: center;
            color: #4b5563;
            font-size: 14px;
            border-top: 1px solid #d6e7d8;
        }
        .details {
            background: #f3f7f4;
            padding: 15px;
            border-radius: 6px;
            margin: 20px 0;
            font-size: 14px;
            color: #374151;
            border: 1px solid #d6e7d8;
        }
    </style>
</head>
<body>
    <div class="container">
        <?php if ($state === 'error' || $state === 'expired'): ?>
            <!-- Error State -->
            <div class="header error">
                <div class="icon"><?php echo $state === 'expired' ? '⌛' : '❌'; ?></div>
                <h1><?php echo htmlspecialchars($title); ?></h1>
            </div>
            <div class="content">
                <div class="title"><?php echo htmlspecialchars($title); ?></div>
                <div class="message"><?php echo htmlspecialchars($message); ?></div>
                <?php if ($state === 'expired'): ?>
                    <a href="http://localhost:4200/resend-verification" class="btn">Request New Verification Email</a>
                <?php else: ?>
                    <a href="http://localhost:4200/login" class="btn">Go to Login</a>
                <?php endif; ?>
            </div>
        <?php else: ?>
            <!-- Success State -->
            <div class="header">
                <div class="icon">✅</div>
                <h1><?php echo htmlspecialchars($title); ?></h1>
            </div>
            <div class="content">
                <div class="title">Welcome to Cycle MRT</div>
                <div class="message">
                    <?php echo htmlspecialchars($message); ?>
                </div>
                
                <div class="details">
                    <strong>Verified Email:</strong> <?php echo $user_email; ?><br>
                    <strong>Verification Time:</strong> <?php echo htmlspecialchars($verification_time); ?><br>
                    <strong>Status:</strong> <?php echo $state === 'already' ? 'Verified (Already Confirmed)' : 'Verified'; ?>
                </div>
                
                <button class="btn" style="opacity:0.7; cursor:not-allowed; pointer-events:none; margin-bottom:12px;" disabled>
                    Verified
                </button>
                <br>
                
                <a href="http://localhost:4200/login" class="btn">Go to Login</a>
                <!-- <a href="http://cyclemart.shop/login" class="btn">Go to Login</a> -->
            </div>
        <?php endif; ?>
        
        <div class="footer">
            <p>© <?php echo date('Y'); ?> Cycle MRT. All rights reserved.</p>
            <p>If you have any questions, contact us at cyclemrt@gmail.com</p>
        </div>
    </div>
</body>
</html>