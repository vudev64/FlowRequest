import SystemSettings from '../models/SystemSettings.js';
import { settingsDefaults } from '../config/settingsDefaults.js';
export async function getEffectiveSettings() {
  const saved = await SystemSettings.findOne({ key: 'system' }).maxTimeMS(3000).lean();
  return saved || { ...settingsDefaults(), revision: 0, updatedAt: null, updatedBy: null };
}
export function passwordError(password, policy, existingMinimum = 6) {
  if (typeof password !== 'string' || password.length < Math.max(policy.minLength, existingMinimum) || Buffer.byteLength(password, 'utf8') > 72) return `Mật khẩu cần ít nhất ${Math.max(policy.minLength, existingMinimum)} ký tự và tối đa 72 byte.`;
  for (const [key, regex, label] of [['uppercase', /[A-Z]/, 'chữ hoa'], ['lowercase', /[a-z]/, 'chữ thường'], ['number', /[0-9]/, 'chữ số'], ['special', /[^a-zA-Z0-9\s]/, 'ký tự đặc biệt']]) if (policy[key] && !regex.test(password)) return `Mật khẩu cần có ${label}.`;
  return null;
}
