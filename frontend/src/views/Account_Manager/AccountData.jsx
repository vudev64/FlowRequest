import { systemTimeZone } from '../../lib/systemConfiguration';

export const ACCOUNT_TABS = [
  { key: 'overview', path: '/account', label: 'Tổng quan', en: 'Overview' },
  { key: 'approvals', path: '/account/approvals', label: 'Xét duyệt đề xuất', en: 'Request approvals' },
  { key: 'payments', path: '/account/payments', label: 'Thanh toán', en: 'Payments' },
];
const CATEGORY_LABELS = { EQUIPMENT: ['Thiết bị', 'Equipment'], SOFTWARE_LICENSE: ['Tool/IDE', 'Software licenses'], CLOUD_RESOURCE: ['Cloud Server', 'Cloud resources'] };
const STATUS_LABELS = {
  DRAFT: ['Bản nháp', 'Draft'], PENDING_MANAGER: ['Chờ Quản lý', 'Pending manager'], PENDING_DIRECTOR: ['Chờ Giám đốc', 'Pending director'],
  PENDING_HRADMIN: ['Chờ HR', 'Pending HR'], PENDING_ACCOUNTANT: ['Chờ Kế toán', 'Pending accountant'], APPROVED: ['Đã duyệt', 'Approved'], REJECTED: ['Đã từ chối', 'Rejected'], CANCELLED: ['Đã hủy', 'Cancelled'],
};
const ROLE_LABELS = { ACCOUNTANT: ['Kế toán', 'Accountant'], EMPLOYEE: ['Nhân viên', 'Employee'], MANAGER: ['Quản lý', 'Manager'], HR_ADMIN: ['Nhân sự', 'HR administrator'], DIRECTOR: ['Giám đốc', 'Director'], SYSTEM_ADMIN: ['Quản trị hệ thống', 'System administrator'] };
const label = (labels, value, lang, fallback = '—') => labels[value]?.[lang === 'en' ? 1 : 0] || value || fallback;
export const money = (amount, lang = 'vi') => new Intl.NumberFormat(lang === 'en' ? 'en-GB' : 'vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(Number(amount) || 0);
export const dateTime = (value, lang = 'vi') => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'vi-VN', { dateStyle: 'short', timeStyle: 'short', timeZone: systemTimeZone() }).format(date);
};
export const categoryLabel = (category, lang = 'vi') => label(CATEGORY_LABELS, category, lang, lang === 'en' ? 'Purchase' : 'Mua sắm');
// These values mirror the existing backend contract, including its legacy trip code.
export const ACCOUNTANT_APPROVAL_TYPES = Object.freeze(['PURCHASE', 'BUNSINESS_TRIP', 'TRAINING']);
export const ACCOUNTANT_VISIBLE_TYPES = Object.freeze([...ACCOUNTANT_APPROVAL_TYPES, 'OVERTIME']);
export const isAccountingRequest = request => ACCOUNTANT_VISIBLE_TYPES.includes(request?.type);
export const requestTypeLabel = (request, lang = 'vi') => request?.type === 'PURCHASE' ? categoryLabel(request.category, lang) : label({ BUNSINESS_TRIP: ['Công tác', 'Business trip'], TRAINING: ['Đào tạo', 'Training'], OVERTIME: ['Tăng ca', 'Overtime'] }, request?.type, lang);
export const statusLabel = (status, lang = 'vi') => label(STATUS_LABELS, status, lang);
export const roleLabel = (role, lang = 'vi') => label(ROLE_LABELS, role?.toUpperCase(), lang);
export const displayName = user => user && typeof user === 'object' ? user.name || user.email || '—' : '—';
export const entityId = value => String(value?._id || value?.id || value || '');
export const initials = name => (name || '').trim().split(/\s+/).filter(Boolean).slice(-2).map(part => part[0]).join('').toUpperCase() || 'KT';
export const pendingForAccountant = request => ACCOUNTANT_APPROVAL_TYPES.includes(request?.type) && request?.status === 'PENDING_ACCOUNTANT';
export const canDecide = (request, user) => Boolean(user?.id || user?._id) && user.role?.toUpperCase() === 'ACCOUNTANT' && pendingForAccountant(request) && Boolean(entityId(request.author)) && entityId(request.author) !== entityId(user);
