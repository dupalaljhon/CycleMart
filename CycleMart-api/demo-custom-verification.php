<?php
/**
 * Demo: Custom Verification Email with Yes/No Buttons
 * This demonstrates how to use the sendCustomVerificationEmail function
 */

require_once 'sendMail.php';

// Demo usage
$demoEmail = 'user@example.com';
$demoToken = 'demo_token_' . uniqid();

echo "<!DOCTYPE html>
<html>
<head>
    <title>Custom Verification Email Demo</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        .demo-section { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .code-block { background: #e9ecef; padding: 15px; border-radius: 4px; font-family: monospace; overflow-x: auto; }
        .success { background: #d4edda; border: 1px solid #c3e6cb; color: #155724; }
        .info { background: #d1ecf1; border: 1px solid #bee5eb; color: #0c5460; }
        .btn { background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block; margin: 5px; }
        .btn:hover { background: #0056b3; }
    </style>
</head>
<body>";

echo "<h1>🚴 Custom Verification Email Demo</h1>";

echo "<div class='demo-section info'>
    <h3>📧 New Function: sendCustomVerificationEmail()</h3>
    <p>This function sends a beautiful verification email with Yes/No buttons as requested:</p>
    <ul>
        <li>✅ <strong>Subject:</strong> \"Verify your Cycle MRT account\"</li>
        <li>🎨 <strong>Design:</strong> Centered card with professional styling</li>
        <li>💚 <strong>Green Button:</strong> \"✅ Yes, it was me\" → verify.php</li>
        <li>❤️ <strong>Red Button:</strong> \"❌ No, not me\" → deny.php</li>
        <li>⚠️ <strong>Footer:</strong> Warning about denial consequences</li>
    </ul>
</div>";

echo "<div class='demo-section'>
    <h3>💻 Code Usage</h3>
    <div class='code-block'>
require_once 'sendMail.php';

// Send custom verification email
\$result = sendCustomVerificationEmail(
    '{$demoEmail}',     // Recipient email
    '{$demoToken}'      // Verification token
);

if (\$result['status'] === 'success') {
    echo 'Verification email sent successfully!';
} else {
    echo 'Error: ' . \$result['message'];
}
    </div>
</div>";

// Show what the email URLs would look like
$verifyUrl = 'https://mywebsite.com/verify.php?token=' . urlencode($demoToken) . '&email=' . urlencode($demoEmail);
$denyUrl = 'https://mywebsite.com/deny.php?token=' . urlencode($demoToken) . '&email=' . urlencode($demoEmail);

echo "<div class='demo-section'>
    <h3>🔗 Generated Email Links</h3>
    <p><strong>✅ Verify Link:</strong></p>
    <div class='code-block'>{$verifyUrl}</div>
    
    <p><strong>❌ Deny Link:</strong></p>
    <div class='code-block'>{$denyUrl}</div>
</div>";

echo "<div class='demo-section success'>
    <h3>✅ Landing Pages Created</h3>
    <p>I've also created the landing pages that handle the verification responses:</p>
    <ul>
        <li><strong>verify.php</strong> - Handles \"Yes, it was me\" responses</li>
        <li><strong>deny.php</strong> - Handles \"No, not me\" responses</li>
    </ul>
    <p>These pages show appropriate success/denial messages and can be integrated with your database.</p>
</div>";

echo "<div class='demo-section'>
    <h3>🧪 Test the Function</h3>
    <p>Use the test page to send actual emails:</p>
    <a href='test-email.php' class='btn'>Open Email Test Page</a>
    
    <p>Or test the landing pages directly:</p>
    <a href='verify.php?token=demo123&email=test@example.com' class='btn'>Test Verify Page</a>
    <a href='deny.php?token=demo123&email=test@example.com' class='btn'>Test Deny Page</a>
</div>";

echo "<div class='demo-section info'>
    <h3>🔧 Integration Notes</h3>
    <p>To integrate this with your CycleMart registration:</p>
    <ol>
        <li>Replace <code>sendVerificationEmail()</code> calls with <code>sendCustomVerificationEmail()</code></li>
        <li>Update verify.php and deny.php to connect to your database</li>
        <li>Modify the URLs to point to your actual domain</li>
        <li>Add proper token validation and user account management</li>
    </ol>
</div>";

echo "</body></html>";
?>