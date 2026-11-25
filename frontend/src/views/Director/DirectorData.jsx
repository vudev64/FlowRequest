import { systemTimeZone } from '../../lib/systemConfiguration';

export const DIRECTOR_TABS = [
  { id: 'overview', label: 'Tổng quan', icon: '▦' },
  { id: 'approvals', label: 'Phê duyệt', icon: '✓' },
  { id: 'reports', label: 'Báo cáo', icon: '▥' },
];

export const formatMoney = (value, lang = 'vi') =>
  Number.isFinite(Number(value)) && value !== null && value !== ''
    ? new Intl.NumberFormat(lang === 'en' ? 'en-GB' : 'vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(Number(value))
    : '—';

export const formatDate = (value, lang = 'vi') => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString(lang === 'en' ? 'en-GB' : 'vi-VN', { timeZone: systemTimeZone() });
};

export const textOf = (value, fallback = '—') => {
  if (typeof value === 'string') return value || fallback;
  if (value && typeof value === 'object') return value.name || value.fullName || value.email || fallback;
  return fallback;
};

export const getId = (obj) => String(typeof obj === 'string' ? obj : obj?._id || obj?.id || '');
export const isDirectorPending = (item) => item?.status === 'PENDING_DIRECTOR';
export const isPurchase = (item) => item?.type === 'PURCHASE';

export const STATUS_LABEL = {
  PENDING_MANAGER: 'Chờ quản lý',
  PENDING_DIRECTOR: 'Chờ giám đốc',
  PENDING_ACCOUNTANT: 'Chờ kế toán',
  PENDING_HRADMIN: 'Chờ nhân sự',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Đã từ chối',
  CANCELLED: 'Đã hủy',
};

const STATUS_EN = { DRAFT: 'Draft', PENDING_MANAGER: 'Pending manager', PENDING_DIRECTOR: 'Pending director', PENDING_ACCOUNTANT: 'Pending accountant', PENDING_HRADMIN: 'Pending HR', APPROVED: 'Approved', REJECTED: 'Rejected', CANCELLED: 'Cancelled' };
export const statusLabel = (status, lang = 'vi') => (lang === 'en' ? STATUS_EN[status] : STATUS_LABEL[status]) || status || '—';
const TYPE_LABEL = { LEAVE: ['Nghỉ phép', 'Leave'], OVERTIME: ['Tăng ca', 'Overtime'], PURCHASE: ['Mua sắm', 'Purchase'], ATTENDANCE: ['Điều chỉnh chấm công', 'Attendance adjustment'], WFH: ['Làm việc từ xa', 'Work from home'], BUNSINESS_TRIP: ['Công tác', 'Business trip'], TRAINING: ['Đào tạo', 'Training'], RECRUITMENT: ['Tuyển dụng', 'Recruitment'] };
const ROLE_LABEL = { EMPLOYEE: ['Nhân viên', 'Employee'], MANAGER: ['Quản lý', 'Manager'], DIRECTOR: ['Giám đốc', 'Director'], HR_ADMIN: ['Nhân sự', 'HR administrator'], ACCOUNTANT: ['Kế toán', 'Accountant'], SYSTEM_ADMIN: ['Quản trị hệ thống', 'System administrator'] };
const CATEGORY_LABEL = { EQUIPMENT: ['Thiết bị', 'Equipment'], SOFTWARE_LICENSE: ['Bản quyền phần mềm', 'Software licence'], CLOUD_RESOURCE: ['Tài nguyên cloud', 'Cloud resources'] };
const localizedLabel = (labels, value, lang) => labels[value]?.[lang === 'en' ? 1 : 0] || value || '—';
export const requestTypeLabel = (type, lang = 'vi') => localizedLabel(TYPE_LABEL, type, lang);
export const roleLabel = (role, lang = 'vi') => localizedLabel(ROLE_LABEL, role?.toUpperCase(), lang);
export const categoryLabel = (category, lang = 'vi') => localizedLabel(CATEGORY_LABEL, category, lang);
export const initials = name => String(name || '').trim().split(/\s+/).filter(Boolean).slice(-2).map(part => part[0]).join('').toUpperCase() || 'GD';

// API có thể trả về mảng trực tiếp, {requests: []}, hoặc {data: {requests: []}}.
// Nếu API có phân trang phía server, cần nạp đủ các trang trước khi xem số liệu là tổng thể.
export const extractRequests = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.requests)) return payload.requests;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.requests)) return payload.data.requests;
  if (Array.isArray(payload?.results)) return payload.results;
  throw new Error('API không trả về danh sách đơn hợp lệ. Vui lòng thử lại.');
};

export const extractRequest = (payload) => {
  const record = payload?.request || payload?.data?.request || payload?.data || payload;
  if (!record || typeof record !== 'object' || Array.isArray(record) || !getId(record)) {
    throw new Error('API không trả về chi tiết đơn hợp lệ.');
  }
  return record;
};

// Mirrors the existing backend workflow; changes to that contract are tested.
export const DIRECTOR_REQUEST_TYPES = Object.freeze(['LEAVE', 'OVERTIME', 'PURCHASE', 'ATTENDANCE', 'WFH', 'BUNSINESS_TRIP', 'TRAINING', 'RECRUITMENT']);
export const canDirectorDecide = (request, user) => user?.role?.toUpperCase() === 'DIRECTOR'
  && Boolean(getId(user)) && isDirectorPending(request)
  && DIRECTOR_REQUEST_TYPES.includes(request.type)
  && Boolean(getId(request.author)) && getId(request.author) !== getId(user);

export const calendarDay = (value) => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric', month: '2-digit', day: '2-digit', timeZone: systemTimeZone(),
  }).formatToParts(date);
  const part = type => parts.find(item => item.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
};

export function monthlyPurchases(requests, year) {
  const months = Array.from({ length: 12 }, (_, index) => ({ month: index + 1, proposed: 0, approved: 0, count: 0 }));
  for (const request of requests) {
    if (!isPurchase(request) || ['DRAFT', 'CANCELLED'].includes(request.status)) continue;
    const day = calendarDay(request.createdAt);
    if (!day || day.slice(0, 4) !== String(year)) continue;
    const amount = Number(request.amount);
    if (!Number.isFinite(amount) || amount < 0) continue;
    const bucket = months[Number(day.slice(5, 7)) - 1];
    bucket.proposed += amount;
    bucket.count++;
    if (request.status === 'APPROVED') bucket.approved += amount;
  }
  return months;
}

export function getReadableError(error) {
  if (error instanceof Error) return error.message;
  return 'Không thể thực hiện yêu cầu.';
}
