<?php
require_once __DIR__ . '/../modules/vendor/autoload.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\SMTP;
use PHPMailer\PHPMailer\Exception;

class EmailService {
    private $mail;
    
    // Email configuration - Update these with your SMTP settings
    private $host = 'smtp.gmail.com';  // Gmail SMTP server
    private $username = 'your-actual-email@gmail.com';  // Replace with your actual Gmail address
    private $password = 'your-16-char-app-password';     // Replace with your Gmail app password (16 characters, not regular password)
    private $port = 587;
    private $fromEmail = 'your-actual-email@gmail.com';  // Should match username
    private $fromName = 'CycleMart';
    
    public function __construct() {
        $this->mail = new PHPMailer(true);
        $this->configureSMTP();
    }
    
    private function configureSMTP() {
        try {
            // Server settings
            $this->mail->isSMTP();
            $this->mail->Host       = $this->host;
            $this->mail->SMTPAuth   = true;
            $this->mail->Username   = $this->username;
            $this->mail->Password   = $this->password;
            $this->mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
            $this->mail->Port       = $this->port;
            
            // Recipients
            $this->mail->setFrom($this->fromEmail, $this->fromName);
        } catch (Exception $e) {
            error_log("SMTP Configuration Error: " . $e->getMessage());
        }
    }
    
    public function sendVerificationEmail($toEmail, $fullName, $verificationToken) {
        try {
            $this->mail->clearAddresses();
            $this->mail->addAddress($toEmail, $fullName);
            
            // Content
            $this->mail->isHTML(true);
            $this->mail->Subject = 'Verify Your CycleMart Account';
            
            $verificationLink = "http://localhost:4200/verify-email?token=" . urlencode($verificationToken);
            
            $this->mail->Body = $this->getVerificationEmailTemplate($fullName, $verificationLink);
            $this->mail->AltBody = "Hi $fullName,\n\nPlease verify your email by clicking this link: $verificationLink\n\nIf you didn't create an account, please ignore this email.\n\nBest regards,\nCycleMart Team";
            
            $this->mail->send();
            return ['success' => true, 'message' => 'Verification email sent successfully'];
        } catch (Exception $e) {
            error_log("Email sending failed: " . $e->getMessage());
            return ['success' => false, 'message' => 'Failed to send verification email: ' . $e->getMessage()];
        }
    }
    
    private function getVerificationEmailTemplate($fullName, $verificationLink) {
        return "
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset='UTF-8'>
            <meta name='viewport' content='width=device-width, initial-scale=1.0'>
            <title>Verify Your Email</title>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background-color: #213A57; color: white; padding: 20px; text-align: center; }
                .content { background-color: #f9f9f9; padding: 30px; }
                .button { 
                    display: inline-block; 
                    padding: 12px 30px; 
                    background-color: #213A57; 
                    color: white; 
                    text-decoration: none; 
                    border-radius: 5px; 
                    margin: 20px 0; 
                }
                .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
            </style>
        </head>
        <body>
            <div class='container'>
                <div class='header'>
                    <h1>Welcome to CycleMart!</h1>
                </div>
                <div class='content'>
                    <h2>Hi $fullName,</h2>
                    <p>Thank you for registering with CycleMart! To complete your account setup, please verify your email address by clicking the button below:</p>
                    
                    <p style='text-align: center;'>
                        <a href='$verificationLink' class='button'>Verify Email Address</a>
                    </p>
                    
                    <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
                    <p style='word-break: break-all; background-color: #e9e9e9; padding: 10px; border-radius: 5px;'>$verificationLink</p>
                    
                    <p><strong>This verification link will expire in 24 hours.</strong></p>
                    
                    <p>If you didn't create an account with CycleMart, please ignore this email.</p>
                    
                    <p>Best regards,<br>The CycleMart Team</p>
                </div>
                <div class='footer'>
                    <p>&copy; 2025 CycleMart. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
        ";
    }
    
    public function sendWelcomeEmail($toEmail, $fullName) {
        try {
            $this->mail->clearAddresses();
            $this->mail->addAddress($toEmail, $fullName);
            
            $this->mail->isHTML(true);
            $this->mail->Subject = 'Welcome to CycleMart!';
            
            $this->mail->Body = $this->getWelcomeEmailTemplate($fullName);
            $this->mail->AltBody = "Hi $fullName,\n\nWelcome to CycleMart! Your account has been successfully verified.\n\nYou can now start buying and selling bike parts on our platform.\n\nBest regards,\nCycleMart Team";
            
            $this->mail->send();
            return ['success' => true, 'message' => 'Welcome email sent successfully'];
        } catch (Exception $e) {
            error_log("Welcome email sending failed: " . $e->getMessage());
            return ['success' => false, 'message' => 'Failed to send welcome email'];
        }
    }
    
    private function getWelcomeEmailTemplate($fullName) {
        return "
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset='UTF-8'>
            <meta name='viewport' content='width=device-width, initial-scale=1.0'>
            <title>Welcome to CycleMart</title>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background-color: #213A57; color: white; padding: 20px; text-align: center; }
                .content { background-color: #f9f9f9; padding: 30px; }
                .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
            </style>
        </head>
        <body>
            <div class='container'>
                <div class='header'>
                    <h1>🎉 Account Verified!</h1>
                </div>
                <div class='content'>
                    <h2>Hi $fullName,</h2>
                    <p>Congratulations! Your CycleMart account has been successfully verified.</p>
                    
                    <p>You can now:</p>
                    <ul>
                        <li>Browse and search for bike parts</li>
                        <li>List your own items for sale</li>
                        <li>Connect with other cyclists</li>
                        <li>Manage your profile and listings</li>
                    </ul>
                    
                    <p>Start exploring CycleMart and find the perfect bike parts for your needs!</p>
                    
                    <p>Best regards,<br>The CycleMart Team</p>
                </div>
                <div class='footer'>
                    <p>&copy; 2025 CycleMart. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
        ";
    }
}
?>
