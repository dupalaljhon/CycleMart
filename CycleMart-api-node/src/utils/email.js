import * as Brevo from '@getbrevo/brevo';

const apiInstance = new Brevo.TransactionalEmailsApi();
apiInstance.setApiKey(
  Brevo.TransactionalEmailsApiApiKeys.apiKey,
  process.env.BREVO_API_KEY
);

export async function sendEmail({ to, subject, html, text, name }) {
  const fromEmail = process.env.SMTP_FROM_EMAIL;
  const fromName = process.env.SMTP_FROM_NAME || 'CycleMart';

  if (!fromEmail) {
    return { status: 'error', message: 'SMTP_FROM_EMAIL is not configured' };
  }

  try {
    const sendSmtpEmail = new Brevo.SendSmtpEmail();
    sendSmtpEmail.subject = subject;
    sendSmtpEmail.htmlContent = html;
    sendSmtpEmail.textContent = text;
    sendSmtpEmail.sender = { name: fromName, email: fromEmail };
    sendSmtpEmail.to = [{ email: to, name: name || to }];

    await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log('✅ Email sent successfully to:', to);
    return { status: 'success', message: 'Email sent successfully' };
  } catch (error) {
    console.error('❌ Brevo Email Error:', error.message);
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
  <title>Verify Your CycleMart Account</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #2e7d32; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f3f7f4; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #d6e7d8; border-top: 0; }
    .btn { display: inline-block; padding: 12px 24px; background: #2e7d32; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; }
    .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header"><h1>Welcome to CycleMart</h1></div>
    <div class="content">
      <h2>Hello ${safeName}!</h2>
      <p>Thanks for registering. Please verify your email by clicking below.</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${safeUrl}" class="btn">Verify My Account</a>
      </div>
      <p>Or copy this link: <span style="word-break: break-all;">${safeUrl}</span></p>
      <p>This link expires in 24 hours.</p>
      <p>Best regards,<br/>The CycleMart Team</p>
    </div>
    <div class="footer"><p>CycleMart - automated email, please do not reply.</p></div>
  </div>
</body>
</html>`;

  const text = `Hello ${safeName},\n\nVerify your account:\n${safeUrl}\n\nExpires in 24 hours.`;
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
  <title>Verify your CycleMart account</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; }
    .header { background: linear-gradient(135deg, #2e7d32 0%, #3f9a45 100%); color: white; padding: 30px 20px; text-align: center; }
    .content { padding: 40px 30px; text-align: center; }
    .btn { display: inline-block; padding: 15px 30px; margin: 10px 15px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; }
    .btn-yes { background-color: #2e7d32; color: white; }
    .btn-no { background-color: #f3f7f4; color: #111827; border: 1px solid #d1d5db; }
    .footer { background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #6c757d; border-top: 1px solid #e9ecef; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div style="font-size: 24px; font-weight: bold;">CycleMart</div>
      <div>Account Verification</div>
    </div>
    <div class="content">
      <h2>Hello ${safeName}</h2>
      <p>Please confirm this email address to activate your account.</p>
      <div>
        <a href="${safeVerifyUrl}" class="btn btn-yes">Yes, it was me</a>
        <a href="${safeDenyUrl}" class="btn btn-no">No, not me</a>
      </div>
      <p style="margin-top: 30px; font-size: 14px; color: #666;">
        Sent to: <strong>${safeEmail}</strong>
      </p>
    </div>
    <div class="footer">
      <p>Choosing "No" will cancel the account request.</p>
      <p>CycleMart - automated email, please do not reply.</p>
    </div>
  </div>
</body>
</html>`;

  const text = `Hello ${safeName},\n\nConfirm your account:\n- Yes: ${safeVerifyUrl}\n- No: ${safeDenyUrl}\n\nSent to: ${safeEmail}`;
  return { html, text };
}