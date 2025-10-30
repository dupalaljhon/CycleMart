<?php
/**
 * Test script for sendMail.php
 * Use this to test email functionality before implementing in your application
 */

require_once 'sendMail.php';

?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CycleMart Email Test</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        .container { background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .success { background: #d4edda; border: 1px solid #c3e6cb; color: #155724; }
        .error { background: #f8d7da; border: 1px solid #f5c6cb; color: #721c24; }
        .info { background: #d1ecf1; border: 1px solid #bee5eb; color: #0c5460; }
        form { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
        input, textarea, select { width: 100%; padding: 10px; margin: 10px 0; border: 1px solid #ddd; border-radius: 4px; }
        button { background: #6BA3BE; color: white; padding: 12px 24px; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; }
        button:hover { background: #5a92a5; }
        .test-buttons { display: flex; gap: 10px; margin: 20px 0; }
        .test-buttons button { flex: 1; }
    </style>
</head>
<body>
    <h1>🚴 CycleMart Email Testing System</h1>
    
    <?php
    // Handle form submissions
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        if (isset($_POST['test_verification'])) {
            // Test verification email
            $result = sendVerificationEmail(
                $_POST['test_email'],
                $_POST['test_name'],
                'test_token_' . uniqid(),
                'http://localhost:4200'
            );
            
            echo '<div class="container ' . ($result['status'] === 'success' ? 'success' : 'error') . '">';
            echo '<h3>Verification Email Test Result:</h3>';
            echo '<p><strong>Status:</strong> ' . $result['status'] . '</p>';
            echo '<p><strong>Message:</strong> ' . $result['message'] . '</p>';
            echo '<p><strong>Recipient:</strong> ' . $result['recipient'] . '</p>';
            echo '</div>';
            
        } elseif (isset($_POST['test_reset'])) {
            // Test password reset email
            $result = sendPasswordResetEmail(
                $_POST['test_email'],
                $_POST['test_name'],
                'reset_token_' . uniqid(),
                'http://localhost:4200'
            );
            
            echo '<div class="container ' . ($result['status'] === 'success' ? 'success' : 'error') . '">';
            echo '<h3>Password Reset Email Test Result:</h3>';
            echo '<p><strong>Status:</strong> ' . $result['status'] . '</p>';
            echo '<p><strong>Message:</strong> ' . $result['message'] . '</p>';
            echo '<p><strong>Recipient:</strong> ' . $result['recipient'] . '</p>';
            echo '</div>';
            
        } elseif (isset($_POST['test_custom_verification'])) {
            // Test custom verification email with Yes/No buttons
            $result = sendCustomVerificationEmail(
                $_POST['test_email'],
                'custom_token_' . uniqid()
            );
            
            echo '<div class="container ' . ($result['status'] === 'success' ? 'success' : 'error') . '">';
            echo '<h3>Custom Verification Email Test Result:</h3>';
            echo '<p><strong>Status:</strong> ' . $result['status'] . '</p>';
            echo '<p><strong>Message:</strong> ' . $result['message'] . '</p>';
            echo '<p><strong>Recipient:</strong> ' . $result['recipient'] . '</p>';
            echo '</div>';
            
        } elseif (isset($_POST['test_custom'])) {
            // Test custom email
            $result = sendEmail(
                $_POST['custom_email'],
                $_POST['custom_subject'],
                $_POST['custom_body'],
                $_POST['custom_name'],
                $_POST['is_html'] === 'true'
            );
            
            echo '<div class="container ' . ($result['status'] === 'success' ? 'success' : 'error') . '">';
            echo '<h3>Custom Email Test Result:</h3>';
            echo '<p><strong>Status:</strong> ' . $result['status'] . '</p>';
            echo '<p><strong>Message:</strong> ' . $result['message'] . '</p>';
            echo '<p><strong>Recipient:</strong> ' . $result['recipient'] . '</p>';
            echo '</div>';
        }
    }
    ?>
    
    <div class="container info">
        <h3>📧 Email Configuration Status</h3>
        <p><strong>SMTP Host:</strong> <?php echo SMTP_HOST; ?></p>
        <p><strong>SMTP Port:</strong> <?php echo SMTP_PORT; ?></p>
        <p><strong>From Email:</strong> <?php echo SMTP_FROM_EMAIL; ?></p>
        <p><strong>From Name:</strong> <?php echo SMTP_FROM_NAME; ?></p>
        <p><strong>PHPMailer Status:</strong> 
            <?php 
            if (class_exists('PHPMailer\PHPMailer\PHPMailer')) {
                echo '<span style="color: green;">✅ Loaded</span>';
            } else {
                echo '<span style="color: red;">❌ Not Found</span>';
            }
            ?>
        </p>
    </div>

    <!-- Quick Test Buttons -->
    <form method="post">
        <h3>🧪 Quick Email Tests</h3>
        <div>
            <label for="test_email">Test Email Address:</label>
            <input type="email" id="test_email" name="test_email" placeholder="your-email@example.com" required>
        </div>
        <div>
            <label for="test_name">Test Recipient Name:</label>
            <input type="text" id="test_name" name="test_name" placeholder="John Doe" required>
        </div>
        
        <div class="test-buttons">
            <button type="submit" name="test_verification">
                📧 Test Verification Email
            </button>
            <button type="submit" name="test_reset">
                🔐 Test Password Reset Email
            </button>
            <button type="submit" name="test_custom_verification">
                ✅❌ Test Custom Verification (Yes/No)
            </button>
        </div>
    </form>

    <!-- Custom Email Test -->
    <form method="post">
        <h3>✉️ Custom Email Test</h3>
        <div>
            <label for="custom_email">Recipient Email:</label>
            <input type="email" id="custom_email" name="custom_email" placeholder="recipient@example.com" required>
        </div>
        <div>
            <label for="custom_name">Recipient Name:</label>
            <input type="text" id="custom_name" name="custom_name" placeholder="Recipient Name">
        </div>
        <div>
            <label for="custom_subject">Subject:</label>
            <input type="text" id="custom_subject" name="custom_subject" placeholder="Test Email Subject" required>
        </div>
        <div>
            <label for="custom_body">Email Body:</label>
            <textarea id="custom_body" name="custom_body" rows="6" placeholder="Enter your email content here..." required></textarea>
        </div>
        <div>
            <label for="is_html">Email Format:</label>
            <select id="is_html" name="is_html">
                <option value="true">HTML</option>
                <option value="false">Plain Text</option>
            </select>
        </div>
        <button type="submit" name="test_custom">
            🚀 Send Custom Email
        </button>
    </form>

    <!-- Usage Instructions -->
    <div class="container info">
        <h3>📋 Usage Instructions</h3>
        <h4>1. Include in your PHP files:</h4>
        <pre><code>require_once 'sendMail.php';</code></pre>
        
        <h4>2. Send verification email:</h4>
        <pre><code>$result = sendVerificationEmail($email, $name, $token, $baseUrl);</code></pre>
        
        <h4>3. Send password reset email:</h4>
        <pre><code>$result = sendPasswordResetEmail($email, $name, $resetToken, $baseUrl);</code></pre>
        
        <h4>4. Send custom email:</h4>
        <pre><code>$result = sendEmail($email, $subject, $body, $name, $isHTML);</code></pre>
        
        <h4>5. Send custom verification with Yes/No buttons:</h4>
        <pre><code>$result = sendCustomVerificationEmail($email, $token);</code></pre>
        
        <h4>6. Via POST request:</h4>
        <pre><code>POST to: sendMail.php
{
    "recipient": "user@example.com",
    "subject": "Test Subject",
    "body": "Email content",
    "recipient_name": "User Name",
    "is_html": true
}</code></pre>
    </div>

    <!-- Integration Guide -->
    <div class="container">
        <h3>🔧 Integration with CycleMart Registration</h3>
        <p>To integrate with your registration system, add this to your <code>post.php</code> registration method:</p>
        <pre><code>// After successful user registration
require_once '../sendMail.php';

// Generate verification token
$verificationToken = bin2hex(random_bytes(32));
$expiresAt = date('Y-m-d H:i:s', strtotime('+24 hours'));

// Save token to database
$updateSql = "UPDATE users SET verification_token = :token, token_expires_at = :expires 
              WHERE id = :user_id";
$updateStmt = $this->pdo->prepare($updateSql);
$updateStmt->execute([
    ':token' => $verificationToken,
    ':expires' => $expiresAt,
    ':user_id' => $userId
]);

// Send verification email
$emailResult = sendVerificationEmail(
    $email, 
    $full_name, 
    $verificationToken, 
    'http://localhost:4200'
);

if ($emailResult['status'] === 'success') {
    // Email sent successfully
    return $this->sendPayload($data, "success", "Registration successful! Please check your email to verify your account.", 201);
} else {
    // Email failed but user is registered
    return $this->sendPayload($data, "warning", "Registration successful but verification email failed to send. Please contact support.", 201);
}</code></pre>
    </div>

    <div class="container">
        <p><strong>Note:</strong> Make sure your Gmail App Password is correct and 2-factor authentication is enabled on your Gmail account.</p>
        <p><strong>Security:</strong> In production, store sensitive credentials in environment variables or a secure configuration file.</p>
    </div>
</body>
</html>