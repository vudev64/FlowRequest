import { emailConfig } from './environment.js';

// Compatibility baseline taken from the existing application, not seeded DB data.
export const FILE_TYPES = Object.freeze({
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.pdf': 'application/pdf', '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
});
export function settingsDefaults() {
  return {
    general: { companyName: '', systemName: 'FlowRequest', logoUrl: '', language: 'vi', timeZone: 'Asia/Bangkok' },
    security: { sessionMinutes: 10080, maxFailedLogins: 0, lockoutMinutes: 15, password: { minLength: 6, uppercase: false, lowercase: false, number: false, special: false } },
    attachments: { maxSizeMB: 5, extensions: Object.keys(FILE_TYPES) },
    notifications: { enabled: true, email: { enabled: true, senderName: emailConfig().senderName || 'Workflow System', senderEmail: emailConfig().senderAddress || 'onboarding@resend.dev' } },
  };
}
const object = v => !!v && typeof v === 'object' && !Array.isArray(v);
export function validateSettings(input) {
  const errors = {};
  const keys = (value, allowed, at) => {
    if (!object(value) || Object.keys(value).some(k => !allowed.includes(k)) || allowed.some(k => !Object.hasOwn(value, k))) errors[at] = 'Thiếu trường hoặc có trường không được phép.';
  };
  keys(input, ['revision', 'general', 'security', 'attachments', 'notifications'], 'settings');
  if (errors.settings) return { errors };
  keys(input.general, ['companyName', 'systemName', 'logoUrl', 'language', 'timeZone'], 'general');
  keys(input.security, ['sessionMinutes', 'maxFailedLogins', 'lockoutMinutes', 'password'], 'security');
  keys(input.security?.password, ['minLength', 'uppercase', 'lowercase', 'number', 'special'], 'security.password');
  keys(input.attachments, ['maxSizeMB', 'extensions'], 'attachments');
  keys(input.notifications, ['enabled', 'email'], 'notifications');
  keys(input.notifications?.email, ['enabled', 'senderName', 'senderEmail'], 'notifications.email');
  if (Object.keys(errors).length) return { errors };
  const text = (value, max, required = false) => typeof value === 'string' && value.trim().length <= max && (!required || value.trim().length > 0) && !/[\u0000-\u001f\u007f]/.test(value);
  const integer = (value, min, max) => Number.isSafeInteger(value) && value >= min && value <= max;
  if (!integer(input.revision, 0, Number.MAX_SAFE_INTEGER)) errors.revision = 'Phiên bản cấu hình không hợp lệ.';
  const g = input.general, s = input.security, a = input.attachments, n = input.notifications;
  if (!text(g.companyName, 150)) errors['general.companyName'] = 'Tên công ty tối đa 150 ký tự.';
  if (!text(g.systemName, 80, true)) errors['general.systemName'] = 'Tên hệ thống cần 1–80 ký tự.';
  if (!text(g.logoUrl, 2048)) errors['general.logoUrl'] = 'Đường dẫn logo không hợp lệ.';
  else if (g.logoUrl.trim()) {
    try { const url = new URL(g.logoUrl); if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error(); }
    catch { errors['general.logoUrl'] = 'Logo phải là URL HTTP/HTTPS, không chứa tài khoản hoặc mật khẩu.'; }
  }
  if (!['vi', 'en'].includes(g.language)) errors['general.language'] = 'Chỉ hỗ trợ VI hoặc EN.';
  try { if (typeof g.timeZone !== 'string') throw new Error(); new Intl.DateTimeFormat('en', { timeZone: g.timeZone }).format(); } catch { errors['general.timeZone'] = 'Múi giờ IANA không hợp lệ.'; }
  if (!integer(s.sessionMinutes, 5, 43200)) errors['security.sessionMinutes'] = 'Thời hạn phiên từ 5 đến 43200 phút.';
  if (!integer(s.maxFailedLogins, 0, 20)) errors['security.maxFailedLogins'] = 'Giới hạn từ 0 đến 20; 0 giữ cách đăng nhập hiện tại.';
  if (!integer(s.lockoutMinutes, 1, 1440)) errors['security.lockoutMinutes'] = 'Thời gian khóa từ 1 đến 1440 phút.';
  if (!integer(s.password.minLength, 6, 64)) errors['security.password.minLength'] = 'Độ dài tối thiểu từ 6 đến 64 ký tự.';
  for (const key of ['uppercase', 'lowercase', 'number', 'special']) if (typeof s.password[key] !== 'boolean') errors[`security.password.${key}`] = 'Giá trị phải là bật/tắt.';
  if (!integer(a.maxSizeMB, 1, 25)) errors['attachments.maxSizeMB'] = 'Dung lượng từ 1 đến 25 MB.';
  if (!Array.isArray(a.extensions) || !a.extensions.length || a.extensions.some(e => !Object.hasOwn(FILE_TYPES, e)) || new Set(a.extensions).size !== a.extensions.length) errors['attachments.extensions'] = 'Chọn ít nhất một định dạng an toàn được hệ thống hỗ trợ.';
  if (typeof n.enabled !== 'boolean' || typeof n.email.enabled !== 'boolean') errors.notifications = 'Trạng thái thông báo không hợp lệ.';
  if (!text(n.email.senderName, 100, true) || /[<>]/.test(n.email.senderName)) errors['notifications.email.senderName'] = 'Tên gửi email không hợp lệ.';
  if (!text(n.email.senderEmail, 254, true) || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(n.email.senderEmail)) errors['notifications.email.senderEmail'] = 'Địa chỉ gửi email không hợp lệ.';
  if (Object.keys(errors).length) return { errors };
  return { errors, value: { general: { ...g, companyName: g.companyName.trim(), systemName: g.systemName.trim(), logoUrl: g.logoUrl.trim() }, security: structuredClone(s), attachments: structuredClone(a), notifications: { ...n, email: { ...n.email, senderName: n.email.senderName.trim(), senderEmail: n.email.senderEmail.trim().toLowerCase() } } } };
}

