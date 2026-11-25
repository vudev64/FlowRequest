export const ROLE_LABELS = {
  EMPLOYEE: 'Nhân viên',
  MANAGER: 'Quản lý',
  DIRECTOR: 'Giám đốc',
  HR_ADMIN: 'Quản trị nhân sự',
  SYSTEM_ADMIN: 'Quản trị hệ thống',
  ACCOUNTANT: 'Kế toán',
};

import { apiRequest } from '../../lib/api';
import { systemTimeZone } from '../../lib/systemConfiguration';

export const ADMIN_ROLE_OPTIONS = Object.entries(ROLE_LABELS).filter(([role]) => ['DIRECTOR', 'HR_ADMIN'].includes(role)).map(
  ([value, label]) => ({ value, label })
);

export const STATUS_LABELS = {
  ACTIVE: 'Đang hoạt động',
  INACTIVE: 'Đã khóa',
};

export const ACTION_LABELS = { BOOTSTRAP_SYSTEM_ADMIN: 'Khởi tạo System Admin', UPDATE_SYSTEM_SETTINGS: 'Cập nhật cấu hình hệ thống', CREATE_REQUEST: 'Tạo đề xuất', APPROVE_REQUEST: 'Phê duyệt đề xuất', APPROVED_REQUEST: 'Phê duyệt đề xuất', REJECT_REQUEST: 'Từ chối đề xuất', CREATE_USER: 'Tạo nhân sự', UPDATE_USER: 'Cập nhật nhân sự', CREATE_ADMIN_ACCOUNT: 'Tạo tài khoản quản trị', RESET_ADMIN_PASSWORD: 'Reset mật khẩu', UPDATE_ADMIN_STATUS: 'Đổi trạng thái tài khoản' };
export const LOG_ACTION_OPTIONS = Object.entries(ACTION_LABELS).map(([value, label]) => ({ value, label }));

export const formatDateTime = (value) =>
  new Intl.DateTimeFormat('vi-VN', {
    timeZone: systemTimeZone(),
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));

export const formatDateShort = (value) =>
  new Intl.DateTimeFormat('vi-VN', {
    timeZone: systemTimeZone(),
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value));

export const formatVND = (value) =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value);

export const systemAdminApi = {
  getSettings: () => apiRequest('/admin/settings'),
  saveSettings: body => apiRequest('/admin/settings', { method: 'PUT', body }),
  getLogs: filters => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(filters || {})) if (value !== '' && value != null) query.set(key, key === 'result' && value === 'FAIL' ? 'FAILURE' : String(value));
    return apiRequest(`/admin/logs?${query}`);
  },
  getAccounts: () => apiRequest('/admin/accounts'),
  createAccount: body => apiRequest('/admin/accounts', { method: 'POST', body }),
  resetPassword: id => apiRequest(`/admin/accounts/${encodeURIComponent(id)}/reset-password`, { method: 'POST' }),
  toggleAccountStatus: (id, status) => apiRequest(`/admin/accounts/${encodeURIComponent(id)}/status`, { method: 'PATCH', body: { status } }),
};
