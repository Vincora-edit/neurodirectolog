import nodemailer from 'nodemailer';

// Yandex SMTP configuration
const transporter = nodemailer.createTransport({
  host: 'smtp.yandex.ru',
  port: 465,
  secure: true,
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASSWORD || '',
  },
});

// Email templates
const getVerificationEmailHtml = (code: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .container { max-width: 480px; margin: 0 auto; padding: 40px 20px; }
    .logo { font-size: 24px; font-weight: bold; color: #2563eb; margin-bottom: 32px; }
    .code {
      font-size: 32px;
      font-weight: bold;
      letter-spacing: 8px;
      color: #1f2937;
      background: #f3f4f6;
      padding: 16px 24px;
      border-radius: 8px;
      display: inline-block;
      margin: 24px 0;
    }
    .text { color: #4b5563; line-height: 1.6; }
    .footer { margin-top: 32px; font-size: 12px; color: #9ca3af; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">Neurodirectolog</div>
    <p class="text">Здравствуйте!</p>
    <p class="text">Для подтверждения email введите код:</p>
    <div class="code">${code}</div>
    <p class="text">Код действителен 10 минут.</p>
    <p class="text">Если вы не запрашивали код, просто проигнорируйте это письмо.</p>
    <div class="footer">
      Neurodirectolog — управление рекламными кампаниями
    </div>
  </div>
</body>
</html>
`;

export const emailService = {
  /**
   * Generate a random 6-digit verification code
   */
  generateCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  },

  /**
   * Send verification code to email
   */
  async sendVerificationCode(email: string, code: string): Promise<boolean> {
    const fromEmail = process.env.SMTP_USER || 'noreply@neurodirectolog.ru';

    try {
      await transporter.sendMail({
        from: `"Neurodirectolog" <${fromEmail}>`,
        to: email,
        subject: `Код подтверждения: ${code}`,
        text: `Ваш код подтверждения: ${code}\n\nКод действителен 10 минут.\n\nЕсли вы не запрашивали код, проигнорируйте это письмо.`,
        html: getVerificationEmailHtml(code),
      });

      console.log(`[Email] Verification code sent to ${email}`);
      return true;
    } catch (error) {
      console.error(`[Email] Failed to send verification code to ${email}:`, error);
      return false;
    }
  },

  /**
   * Test SMTP connection
   */
  async testConnection(): Promise<boolean> {
    try {
      await transporter.verify();
      console.log('[Email] SMTP connection verified');
      return true;
    } catch (error) {
      console.error('[Email] SMTP connection failed:', error);
      return false;
    }
  },
};
