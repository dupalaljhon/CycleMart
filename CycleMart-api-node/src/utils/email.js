import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT || 465),
  secure: process.env.SMTP_SECURE === 'true',  // true for port 465
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// ADD THIS BLOCK
transporter.verify((error, success) => {
  if (error) {
    console.error('❌ SMTP Connection Failed:', error.message);
  } else {
    console.log('✅ SMTP ready - emails will send correctly');
  }
});

export async function sendEmail({
  to,
  subject,
  html,
  text,
  name
}) {
  const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER;
  const fromName = process.env.SMTP_FROM_NAME || 'CycleMart';

  if (!fromEmail) {
    return {
      status: 'error',
      message: 'SMTP_FROM_EMAIL or SMTP_USER is not configured'
    };
  }

  try {
    await transporter.sendMail({
      from: `${fromName} <${fromEmail}>`,
      to: name ? `${name} <${to}>` : to,
      subject,
      html,
      text
    });

    return { status: 'success', message: 'Email sent successfully' };
  } catch (error) {
    return { status: 'error', message: error.message || 'Email send failed' };
  }
}

export function buildVerificationEmail({ recipientName, verificationUrl }) {
  const safeName = recipientName || 'there';
  const safeUrl = verificationUrl || '#';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Verify Your CycleMart Account</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #2e7d32; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f3f7f4; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #d6e7d8; border-top: 0; }
    .btn { display: inline-block; padding: 12px 24px; background: #2e7d32; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; }
    .btn:hover { background: #256b2a; }
    .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Welcome to CycleMart</h1>
    </div>
    <div class="content">
      <h2>Hello ${safeName}!</h2>
      <p>Thanks for registering with CycleMart. Please verify your email by clicking the button below.</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${safeUrl}" class="btn">Verify My Account</a>
      </div>
      <p>If the button does not work, copy and paste this link into your browser:</p>
      <p style="word-break: break-all; background: #e9e9e9; padding: 10px; border-radius: 4px;">
        ${safeUrl}
      </p>
      <p>This verification link will expire in 24 hours.</p>
      <p>Best regards,<br/>The CycleMart Team</p>
    </div>
    <div class="footer">
      <p>CycleMart - automated email, please do not reply.</p>
    </div>
  </div>
</body>
</html>`;

  const text = `Hello ${safeName},\n\nPlease verify your CycleMart account using this link:\n${safeUrl}\n\nThis link expires in 24 hours.`;

  return { html, text };
}

export function buildCustomVerificationEmail({ recipientName, recipientEmail, verifyUrl, denyUrl }) {
  const safeName = recipientName || 'there';
  const safeEmail = recipientEmail || '';
  const safeVerifyUrl = verifyUrl || '#';
  const safeDenyUrl = denyUrl || '#';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Verify your CycleMart account</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); overflow: hidden; }
    .header { background: linear-gradient(135deg, #2e7d32 0%, #3f9a45 100%); color: white; padding: 30px 20px; text-align: center; }
    .content { padding: 40px 30px; text-align: center; }
    .message { font-size: 18px; color: #555; margin-bottom: 30px; font-weight: 500; }
    .button-container { margin: 30px 0; text-align: center; }
    .btn { display: inline-block; padding: 15px 30px; margin: 10px 15px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; transition: all 0.3s ease; border: none; cursor: pointer; }
    .btn-yes { background-color: #2e7d32; color: white; }
    .btn-yes:hover { background-color: #256b2a; }
    .btn-no { background-color: #f3f7f4; color: #111827; border: 1px solid #d1d5db; }
    .btn-no:hover { background-color: #e5e7eb; }
    .footer { background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #6c757d; border-top: 1px solid #e9ecef; }
    .subtitle { font-size: 16px; opacity: 0.9; }
    .warning { margin-top: 20px; font-size: 13px; color: #475569; font-weight: 500; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div style="font-size: 24px; font-weight: bold; margin-bottom: 10px;">CycleMart</div>
      <div class="subtitle">Account Verification</div>
    </div>
    <div class="content">
      <h2 style="color: #333; margin-bottom: 20px;">Hello ${safeName}</h2>
      <p class="message">Please confirm this email address to activate your account.</p>

      <div class="button-container">
        <a href="${safeVerifyUrl}" class="btn btn-yes">Yes, it was me</a>
        <a href="${safeDenyUrl}" class="btn btn-no">No, not me</a>
      </div>

      <p style="margin-top: 30px; font-size: 14px; color: #666;">
        This verification link was sent to: <strong>${safeEmail}</strong>
      </p>
    </div>
    <div class="footer">
      <p class="warning">Choosing "No" will cancel the account request.</p>
      <p>CycleMart - automated email, please do not reply.</p>
    </div>
  </div>
</body>
</html>`;

  const text = `Hello ${safeName},\n\nPlease confirm your account:\n- Yes, it was me: ${safeVerifyUrl}\n- No, not me: ${safeDenyUrl}\n\nThis verification was sent to: ${safeEmail}`;

  return { html, text };
}
