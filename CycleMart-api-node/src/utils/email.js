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
    return { status: 'success', message: 'Email sent successfully' };
  } catch (error) {
    console.error('❌ Brevo Email Error:', error.message);
    return { status: 'error', message: error.message || 'Email send failed' };
  }
}