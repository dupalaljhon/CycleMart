import { BrevoClient } from '@getbrevo/brevo';

function getClient() {
  return new BrevoClient({ apiKey: process.env.BREVO_API_KEY });
}

export async function sendEmail({ to, subject, html, text, name }) {
  const fromEmail = process.env.SMTP_FROM_EMAIL;
  const fromName = process.env.SMTP_FROM_NAME || "CycleMart";

  if (!fromEmail) {
    return { status: "error", message: "SMTP_FROM_EMAIL is not configured" };
  }

  if (!process.env.BREVO_API_KEY) {
    return { status: "error", message: "BREVO_API_KEY is not configured" };
  }

  try {
    const client = getClient();
    await client.transactionalEmails.sendTransacEmail({
      sender: { name: fromName, email: fromEmail },
      to: [{ email: to, name: name || to }],
      subject,
      htmlContent: html,
      textContent: text
    });
    console.log("Email sent successfully to:", to);
    return { status: "success", message: "Email sent successfully" };
  } catch (error) {
    console.error("Brevo Email Error:", error.message);
    return { status: "error", message: error.message || "Email send failed" };
  }
}

export function buildVerificationEmail({ recipientName, verificationUrl }) {
  const safeName = recipientName || "there";
  const safeUrl = verificationUrl || "#";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Verify Your CycleMart Account</title>
  <style>
    body { font-family: "Segoe UI", Arial, sans-serif; line-height: 1.6; color: #1f2937; background: #eef3f6; margin: 0; padding: 24px; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 14px; overflow: hidden; box-shadow: 0 6px 18px rgba(16, 24, 40, 0.08); }
    .header { background: #2e7d32; color: #ffffff; padding: 26px 24px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 700; }
    .content { padding: 28px 30px 10px; }
    .intro { margin: 12px 0 0; color: #4b5563; }
    .btn-wrap { text-align: center; margin: 26px 0; }
    .btn { display: inline-block; padding: 12px 26px; background: #2e7d32; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 700; letter-spacing: 0.2px; }
    .link-box { background: #f6f8fa; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; margin: 14px 0 4px; word-break: break-all; color: #1d4ed8; }
    .meta { color: #6b7280; font-size: 13px; margin: 10px 0 0; }
    .footer { text-align: center; padding: 16px 24px 24px; font-size: 12px; color: #6b7280; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header"><h1>Welcome to CycleMart</h1></div>
    <div class="content">
      <h2>Hello RECIPIENTNAME!</h2>
      <p class="intro">Thank you for registering with CycleMart, your ultimate destination for premium bike parts and cycling accessories.</p>
      <p>To complete your registration and activate your account, please verify your email address by clicking the button below:</p>
      <div class="btn-wrap">
        <a href="SAFEURL" class="btn">Verify My Account</a>
      </div>
      <p>If the button does not work, copy and paste this link into your browser:</p>
      <div class="link-box">SAFEURL</div>
      <p class="meta">Important: This verification link will expire in 24 hours for security reasons.</p>
      <p>If you did not create this account, please ignore this email.</p>
      <p>Best regards,<br/>The CycleMart Team</p>
    </div>
    <div class="footer">CycleMart - automated email, please do not reply.</div>
  </div>
</body>
</html>`.replace(/RECIPIENTNAME/g, safeName).replace(/SAFEURL/g, safeUrl);

  const text = "Hello " + safeName + ",\n\nVerify your account:\n" + safeUrl + "\n\nExpires in 24 hours.";
  return { html, text };
}

export function buildCustomVerificationEmail({ recipientName, recipientEmail, verifyUrl, denyUrl }) {
  const safeName = recipientName || "there";
  const safeEmail = recipientEmail || "";
  const safeVerifyUrl = verifyUrl || "#";
  const safeDenyUrl = denyUrl || "#";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Verify your CycleMart account</title>
  <style>
    body { font-family: "Segoe UI", Arial, sans-serif; line-height: 1.6; color: #1f2937; background-color: #eef3f6; margin: 0; padding: 24px; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 14px; overflow: hidden; box-shadow: 0 6px 18px rgba(16, 24, 40, 0.08); }
    .header { background: #2e7d32; color: #ffffff; padding: 26px 24px; text-align: center; }
    .title { font-size: 22px; font-weight: 700; margin: 0; }
    .subtitle { font-size: 14px; opacity: 0.95; margin-top: 4px; }
    .content { padding: 28px 30px 18px; text-align: center; }
    .btn { display: inline-block; padding: 12px 24px; margin: 10px 8px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 15px; }
    .btn-yes { background-color: #2e7d32; color: #ffffff; }
    .btn-no { background-color: #f6f8fa; color: #111827; border: 1px solid #e5e7eb; }
    .note { margin-top: 22px; font-size: 13px; color: #6b7280; }
    .footer { background-color: #f6f8fa; padding: 16px 24px; text-align: center; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="title">CycleMart</div>
      <div class="subtitle">Account Verification</div>
    </div>
    <div class="content">
      <h2>Hello SAFENAME</h2>
      <p>Thank you for registering with CycleMart, your ultimate destination for premium bike parts and cycling accessories.</p>
      <p>To activate your account, please confirm your email address:</p>
      <div>
        <a href="SAFEVERIFYURL" class="btn btn-yes">Yes, it was me</a>
        <a href="SAFEDENYURL" class="btn btn-no">No, not me</a>
      </div>
      <p class="note">Sent to: <strong>SAFEEMAIL</strong></p>
      <p style="font-size:13px;color:#6b7280;margin-top:16px;">Important: This verification link will expire in 24 hours for security reasons.</p>
      <p style="font-size:13px;color:#6b7280;">If you did not create this account, click "No, not me" to cancel.</p>
    </div>
    <div class="footer">
      <p>Choosing "No" will cancel the account request.</p>
      <p>CycleMart - automated email, please do not reply.</p>
    </div>
  </div>
</body>
</html>`.replace(/SAFENAME/g, safeName).replace(/SAFEVERIFYURL/g, safeVerifyUrl).replace(/SAFEDENYURL/g, safeDenyUrl).replace(/SAFEEMAIL/g, safeEmail);

  const text = "Hello " + safeName + ",\n\nThank you for registering with CycleMart!\n\nConfirm your account:\n- Yes, it was me: " + safeVerifyUrl + "\n- No, not me: " + safeDenyUrl + "\n\nSent to: " + safeEmail;
  return { html, text };
}
