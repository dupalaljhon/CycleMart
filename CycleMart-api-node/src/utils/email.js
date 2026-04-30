import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT || 587),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
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
