import { Resend } from 'resend';
import { getEffectiveSettings } from './SettingsService.js';
import { emailConfig, environmentName } from '../config/environment.js';

export const sendEmail = async ({ to, subject, html }) => {
  try {
    if (environmentName() === 'demo') return { success: true, skipped: true, reason: 'DEMO_EXTERNAL_EMAIL_DISABLED' };
    const { notifications } = await getEffectiveSettings();
    if (!notifications.enabled || !notifications.email.enabled) return { success: true, skipped: true };
    // Khởi tạo Resend bên trong hàm để đảm bảo dotenv đã load xong .env
    const resend = new Resend(emailConfig().apiKey);
    const data = await resend.emails.send({
      from: `${notifications.email.senderName} <${notifications.email.senderEmail}>`,
      to: [to],
      subject: subject,
      html: html,
    });

    if (data.error) return { success: false, error: data.error.message || 'Không thể gửi email.' };
    return { success: true, data: data.data };
  } catch (error) {
    console.error('Lỗi gửi email qua Resend:', error.message);
    return { success: false, error: error.message };
  }
};
