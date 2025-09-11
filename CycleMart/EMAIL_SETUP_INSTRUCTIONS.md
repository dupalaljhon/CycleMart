# Email Verification Setup Instructions

## 1. Gmail SMTP Configuration

To use Gmail SMTP for sending verification emails, you need to:

### Step 1: Enable 2-Factor Authentication
1. Go to your Google Account settings
2. Security → 2-Step Verification
3. Turn on 2-Step Verification

### Step 2: Generate App Password
1. Go to Security → App passwords
2. Select "Mail" and "Other (Custom name)"
3. Enter "CycleMart" as the name
4. Copy the generated 16-character password

### Step 3: Update Email Configuration
Edit `CycleMart-api/api/config/email.php`:

```php
// Replace these with your actual credentials
private $username = 'your-actual-email@gmail.com';
private $password = 'your-16-character-app-password';  // Not your regular password!
private $fromEmail = 'your-actual-email@gmail.com';
```

## 2. Alternative SMTP Providers

### For development/testing, you can use:
- **Mailtrap**: Free testing service
- **SendGrid**: Free tier available
- **XAMPP Mercury Mail**: Built-in with XAMPP

### Mailtrap Configuration:
```php
private $host = 'smtp.mailtrap.io';
private $username = 'your-mailtrap-username';
private $password = 'your-mailtrap-password';
private $port = 587;
```

## 3. Testing the Email System

1. Register a new user with a valid email address
2. Check your email inbox for the verification email
3. Click the verification link to test the process
4. Check that the user's `is_verified` status is updated in the database

## 4. Customizing Email Templates

You can modify the email templates in `config/email.php`:
- `getVerificationEmailTemplate()` - Registration verification email
- `getWelcomeEmailTemplate()` - Welcome email after verification

## 5. Frontend URLs

Make sure the verification link points to your Angular development server:
- Default: `http://localhost:4200/verify-email?token=...`
- Update the URL in `sendVerificationEmail()` method if your Angular runs on a different port

## 6. Security Notes

- Never commit your actual email credentials to version control
- Use environment variables for production deployment
- Consider using more secure email services for production
- Implement rate limiting for email sending to prevent abuse

## 7. Troubleshooting

Common issues:
- **"Authentication failed"**: Check app password is correct
- **"Connection failed"**: Verify SMTP settings and firewall
- **"Email not received"**: Check spam folder, verify email address
- **"Invalid token"**: Tokens expire after 24 hours

For development, check the PHP error logs in XAMPP for detailed error messages.
