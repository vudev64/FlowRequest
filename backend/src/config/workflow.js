import { REQUEST_STATUS as S, REQUEST_TYPES as T, ROLES as R } from '../constants/enums.js';
// Duy trì việc phê duyệt riêng biệt theo nghiệp vụ, không bắt HR duyệt mua sắm.
// Trường hợp đơn do MANAGER tạo: DIRECTOR duyệt trước rồi đi tiếp.
export const WORKFLOW = {
  [S.PENDING_MANAGER]: {
    role: R.MANAGER,
    types: Object.values(T),
    byAssignee: true,
    next: (r) => {
      switch (r.type) {
        case T.PURCHASE: return r.requiresDirector ? S.PENDING_DIRECTOR : S.PENDING_ACCOUNTANT;
        case T.LEAVE: case T.OVERTIME: case T.ATTENDANCE_ADJUSTMENT:
        case T.TRAINING: case T.RECRUITMENT: return S.PENDING_HRADMIN;
        case T.WFH: return S.APPROVED;
        case T.BUSINESS_TRIP: return r.amount > 0 ? S.PENDING_ACCOUNTANT : S.APPROVED;
        default: throw new Error('Loại đơn chưa có workflow');
      }
    },
  },
  [S.PENDING_DIRECTOR]: {
    role: R.DIRECTOR, types: Object.values(T), byAssignee: false,
    next: (r) => {
      switch (r.type) {
        case T.PURCHASE: return S.PENDING_ACCOUNTANT;
        case T.LEAVE: case T.OVERTIME: case T.ATTENDANCE_ADJUSTMENT:
        case T.TRAINING: case T.RECRUITMENT: return S.PENDING_HRADMIN;
        case T.BUSINESS_TRIP: return r.amount > 0 ? S.PENDING_ACCOUNTANT : S.APPROVED;
        case T.WFH: return S.APPROVED;
        default: throw new Error('Loại đơn chưa có workflow');
      }
    },
  },
  [S.PENDING_HRADMIN]: {
    role: R.HR_ADMIN,
    types: [T.LEAVE, T.OVERTIME, T.ATTENDANCE_ADJUSTMENT, T.TRAINING, T.RECRUITMENT],
    byAssignee: false,
    next: (r) => r.type === T.TRAINING && r.amount > 0 ? S.PENDING_ACCOUNTANT : S.APPROVED,
  },
  [S.PENDING_ACCOUNTANT]: {
    role: R.ACCOUNTANT,
    types: [T.PURCHASE, T.BUSINESS_TRIP, T.TRAINING],
    byAssignee: false,
    next: () => S.APPROVED,
  },
};
export const FINAL_STATUSES = [S.APPROVED, S.REJECTED, S.CANCELLED];
