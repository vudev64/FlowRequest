//Gom quả lý vai trò,trạng thái đơn và ngưỡng tài chính
export const ROLES = Object.freeze({
  EMPLOYEE: 'EMPLOYEE',
  MANAGER: 'MANAGER',
  DIRECTOR: 'DIRECTOR',
  HR_ADMIN: 'HR_ADMIN',
  SYSTEM_ADMIN : 'SYSTEM_ADMIN',
  ACCOUNTANT : 'ACCOUNTANT'
});

export const REQUEST_STATUS = Object.freeze({
  DRAFT: 'DRAFT',
  PENDING_MANAGER: 'PENDING_MANAGER',
  PENDING_DIRECTOR: 'PENDING_DIRECTOR',
  PENDING_HRADMIN: 'PENDING_HRADMIN',
  PENDING_ACCOUNTANT: 'PENDING_ACCOUNTANT',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED'
});

export const REQUEST_TYPES = Object.freeze({
  LEAVE: 'LEAVE',
  OVERTIME: 'OVERTIME',
  PURCHASE: 'PURCHASE',

  // các loại đề xuất mới
  ATTENDANCE: "ATTENDANCE",
  ATTENDANCE_ADJUSTMENT: "ATTENDANCE",
  WFH : "WFH",
  BUSINESS_TRIP : "BUNSINESS_TRIP",
  TRAINING : "TRAINING",
  RECRUITMENT : "RECRUITMENT"
});
// MỚI: loại nghỉ phép
export const LEAVE_TYPES = Object.freeze({
  ANNUAL: 'ANNUAL',     // Phép năm
  SICK: 'SICK',          // Nghỉ ốm
  PERSONAL: 'PERSONAL',  // Việc riêng
  UNPAID: 'UNPAID'       // Không lương
});
// Ngưỡng phe duyệt tài chính
export const FINANCIAL = Object.freeze({
    DIRECTOR : 50000000, // >= 50 triệu
});
