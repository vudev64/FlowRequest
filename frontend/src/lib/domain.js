export const ROLES = [
  {
    id: 'employee',
    name: 'Nhân viên',
    tagline: 'Tạo đơn',
    can: 'Tạo và theo dõi đơn của mình.',
    cannot: 'Không thể duyệt đơn của chính mình.',
  },
  {
    id: 'manager',
    name: 'Manager',
    tagline: 'Duyệt cấp 1',
    can: 'Duyệt đơn của nhân viên trong bộ phận.',
    cannot: 'Không thể tự duyệt đơn do mình tạo.',
  },
  {
    id: 'hr_admin',
    name: 'HR',
    tagline: 'Ghi nhận nhân sự',
    can: 'Ghi nhận đơn nghỉ phép và tăng ca.',
    cannot: 'Không thể thay đổi quyền quản trị hệ thống.',
  },
  {
    id: 'accountant',
    name: 'Kế toán',
    tagline: 'Xử lý mua sắm',
    can: 'Xử lý đơn mua sắm và tăng ca.',
    cannot: 'Không thể duyệt đơn ngoài phạm vi phụ trách.',
  },
  {
    id: 'director',
    name: 'Director',
    tagline: 'Duyệt cấp cao',
    can: 'Duyệt các đơn cần qua cấp giám đốc.',
    cannot: 'Không thể tự duyệt đơn do mình tạo.',
  },
  {
    id: 'system_admin',
    name: 'System Admin',
    tagline: 'Quản trị hệ thống',
    can: 'Quản trị tài khoản và cấu hình hệ thống.',
    cannot: 'Không thể duyệt đơn của chính mình.',
  },
];

export const REQUEST_TYPES = [
  {
    id: 'leave',
    name: 'Nghỉ phép',
    description: 'Tạo và theo dõi yêu cầu nghỉ phép theo luồng duyệt.',
    color: 'sky',
  },
  {
    id: 'overtime',
    name: 'Tăng ca',
    description: 'Gửi yêu cầu tăng ca để quản lý và bộ phận liên quan xử lý.',
    color: 'amber',
  },
  {
    id: 'purchase',
    name: 'Mua sắm',
    description: 'Theo dõi đề xuất mua sắm và các cấp phê duyệt.',
    color: 'violet',
  },
];

export const APPROVAL_STEPS = [
  {
    from: 'Nhân viên',
    to: 'Manager',
    note: 'Đơn được chuyển đến quản lý trực tiếp để phê duyệt.',
  },
  {
    from: 'Manager',
    to: 'HR',
    note: 'Đơn nghỉ phép và tăng ca được HR ghi nhận sau khi duyệt.',
  },
  {
    from: 'Manager',
    to: 'Kế toán',
    note: 'Đơn mua sắm được chuyển đến Kế toán xử lý.',
  },
  {
    from: 'Manager',
    to: 'Director',
    note: 'Đơn của Manager cần qua Director trước khi hoàn tất.',
  },
];
